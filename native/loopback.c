// Windows WASAPI loopback. Only six FFT powers and level metrics leave this process.
#define COBJMACROS
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <initguid.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <ksmedia.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#define FFT_SIZE 4096
#define PI 3.14159265358979323846
static const double edges[] = {50, 120, 250, 1000, 4000, 8000, 16000};
static double samples[FFT_SIZE], real[FFT_SIZE], imag[FFT_SIZE], window[FFT_SIZE];
static unsigned cursor;

typedef struct {
  IMMDeviceEnumerator *enumerator;
  IMMDevice *device;
  IAudioClient *client;
  IAudioCaptureClient *capture;
  WAVEFORMATEX *format;
  LPWSTR device_id;
  int floating;
  unsigned valid_bits;
} Capture;

static void reset_samples(void) { memset(samples, 0, sizeof(samples)); cursor = 0; }
static void push_sample(double value) {
  samples[cursor] = isfinite(value) ? fmax(-1, fmin(1, value)) : 0;
  cursor = (cursor + 1) % FFT_SIZE;
}
static void emit_frame(unsigned rate, int self_test, double frequency) {
  double energy = 0, peak = 0, powers[6] = {0};
  for (unsigned i = 0; i < FFT_SIZE; i++) {
    double value = samples[(cursor + i) % FFT_SIZE];
    energy += value * value;
    peak = fmax(peak, fabs(value));
    real[i] = value * window[i]; imag[i] = 0;
  }
  for (unsigned i = 1, j = 0; i < FFT_SIZE; i++) {
    unsigned bit = FFT_SIZE >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { double t = real[i]; real[i] = real[j]; real[j] = t; }
  }
  for (unsigned length = 2; length <= FFT_SIZE; length <<= 1) {
    double wr = cos(-2 * PI / length), wi = sin(-2 * PI / length);
    for (unsigned i = 0; i < FFT_SIZE; i += length) {
      double xr = 1, xi = 0;
      for (unsigned j = 0; j < length / 2; j++) {
        unsigned a = i + j, b = a + length / 2;
        double vr = real[b] * xr - imag[b] * xi, vi = real[b] * xi + imag[b] * xr;
        real[b] = real[a] - vr; imag[b] = imag[a] - vi;
        real[a] += vr; imag[a] += vi;
        double next = xr * wr - xi * wi; xi = xr * wi + xi * wr; xr = next;
      }
    }
  }
  double width = (double)rate / FFT_SIZE;
  for (unsigned band = 0; band < 6; band++) {
    double high = fmin(edges[band + 1], rate / 2.0);
    for (unsigned bin = 1; bin < FFT_SIZE / 2; bin++) {
      double overlap = fmax(0, fmin(high, (bin + .5) * width) - fmax(edges[band], (bin - .5) * width));
      powers[band] += (real[bin] * real[bin] + imag[bin] * imag[bin]) / ((double)FFT_SIZE * FFT_SIZE) * overlap / width;
    }
  }
  if (self_test) printf("{\"frequency\":%.0f,", frequency);
  else printf("{\"type\":\"frame\",");
  printf("\"sampleRate\":%u,\"rms\":%.9g,\"peak\":%.9g,\"powers\":[", rate, sqrt(energy / FFT_SIZE), peak);
  for (unsigned i = 0; i < 6; i++) printf("%s%.9g", i ? "," : "", powers[i]);
  puts("]}"); fflush(stdout);
}
static int parent_alive(void) {
  HANDLE input = GetStdHandle(STD_INPUT_HANDLE);
  if (GetFileType(input) != FILE_TYPE_PIPE) return 1;
  DWORD available = 0;
  if (!PeekNamedPipe(input, NULL, 0, NULL, &available, NULL)) return 0;
  if (available) {
    char bytes[64]; DWORD count;
    if (!ReadFile(input, bytes, sizeof(bytes), &count, NULL) || !count) return 0;
    if (memchr(bytes, 'q', count)) return 0;
  }
  return 1;
}
static void close_capture(Capture *s) {
  if (s->client) IAudioClient_Stop(s->client);
  if (s->capture) IAudioCaptureClient_Release(s->capture);
  if (s->client) IAudioClient_Release(s->client);
  if (s->device) IMMDevice_Release(s->device);
  if (s->enumerator) IMMDeviceEnumerator_Release(s->enumerator);
  CoTaskMemFree(s->format); CoTaskMemFree(s->device_id);
  memset(s, 0, sizeof(*s)); reset_samples();
}
static HRESULT open_capture(Capture *s) {
  HRESULT hr = CoCreateInstance(&CLSID_MMDeviceEnumerator, NULL, CLSCTX_ALL, &IID_IMMDeviceEnumerator, (void **)&s->enumerator);
  if (FAILED(hr)) return hr;
  hr = IMMDeviceEnumerator_GetDefaultAudioEndpoint(s->enumerator, eRender, eConsole, &s->device);
  if (FAILED(hr)) return hr;
  hr = IMMDevice_GetId(s->device, &s->device_id);
  if (FAILED(hr)) return hr;
  hr = IMMDevice_Activate(s->device, &IID_IAudioClient, CLSCTX_ALL, NULL, (void **)&s->client);
  if (FAILED(hr)) return hr;
  hr = IAudioClient_GetMixFormat(s->client, &s->format);
  if (FAILED(hr)) return hr;
  WAVEFORMATEX *f = s->format;
  s->valid_bits = f->wBitsPerSample;
  s->floating = f->wFormatTag == WAVE_FORMAT_IEEE_FLOAT;
  int pcm = f->wFormatTag == WAVE_FORMAT_PCM;
  if (f->wFormatTag == WAVE_FORMAT_EXTENSIBLE && f->cbSize >= 22) {
    WAVEFORMATEXTENSIBLE *ext = (WAVEFORMATEXTENSIBLE *)f;
    s->floating = IsEqualGUID(&ext->SubFormat, &KSDATAFORMAT_SUBTYPE_IEEE_FLOAT);
    pcm = IsEqualGUID(&ext->SubFormat, &KSDATAFORMAT_SUBTYPE_PCM);
    s->valid_bits = ext->Samples.wValidBitsPerSample ? ext->Samples.wValidBitsPerSample : f->wBitsPerSample;
  }
  if (!f->nChannels || !f->nSamplesPerSec || f->nBlockAlign != f->nChannels * (f->wBitsPerSample / 8) ||
      (!s->floating && !pcm) || (s->floating ? f->wBitsPerSample != 32 :
      (f->wBitsPerSample != 16 && f->wBitsPerSample != 24 && f->wBitsPerSample != 32))) return AUDCLNT_E_UNSUPPORTED_FORMAT;
  hr = IAudioClient_Initialize(s->client, AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK, 1000000, 0, f, NULL);
  if (FAILED(hr)) return hr;
  hr = IAudioClient_GetService(s->client, &IID_IAudioCaptureClient, (void **)&s->capture);
  if (FAILED(hr)) return hr;
  hr = IAudioClient_Start(s->client);
  if (SUCCEEDED(hr)) {
    printf("{\"type\":\"ready\",\"sampleRate\":%lu}\n", (unsigned long)f->nSamplesPerSec); fflush(stdout);
  }
  return hr;
}
static double decode_sample(const BYTE *p, const Capture *s) {
  unsigned bits = s->format->wBitsPerSample;
  if (s->floating) { float v; memcpy(&v, p, sizeof(v)); return v; }
  if (bits == 16) { int16_t v; memcpy(&v, p, sizeof(v)); return v / 32768.0; }
  if (bits == 24) {
    int32_t v = (int32_t)((uint32_t)p[0] | (uint32_t)p[1] << 8 | (uint32_t)p[2] << 16);
    if (v & 0x800000) v |= (int32_t)0xff000000;
    return v / 8388608.0;
  }
  int32_t v; memcpy(&v, p, sizeof(v)); return v / 2147483648.0;
}
static HRESULT drain(Capture *s, int *received) {
  UINT32 pending; HRESULT hr;
  *received = 0;
  while (SUCCEEDED(hr = IAudioCaptureClient_GetNextPacketSize(s->capture, &pending)) && pending) {
    BYTE *data; UINT32 frames; DWORD flags;
    hr = IAudioCaptureClient_GetBuffer(s->capture, &data, &frames, &flags, NULL, NULL);
    if (FAILED(hr)) return hr;
    if (flags & AUDCLNT_BUFFERFLAGS_DATA_DISCONTINUITY) reset_samples();
    unsigned channels = s->format->nChannels, bytes = s->format->wBitsPerSample / 8;
    for (UINT32 i = 0; i < frames; i++) {
      double mono = 0;
      if (!(flags & AUDCLNT_BUFFERFLAGS_SILENT))
        for (unsigned ch = 0; ch < channels; ch++) mono += decode_sample(data + i * s->format->nBlockAlign + ch * bytes, s);
      push_sample(mono / channels);
    }
    hr = IAudioCaptureClient_ReleaseBuffer(s->capture, frames);
    if (FAILED(hr)) return hr;
    *received = 1;
  }
  return hr;
}
static int device_changed(Capture *s) {
  IMMDevice *device = NULL; LPWSTR id = NULL; int changed = 1;
  if (SUCCEEDED(IMMDeviceEnumerator_GetDefaultAudioEndpoint(s->enumerator, eRender, eConsole, &device)) &&
      SUCCEEDED(IMMDevice_GetId(device, &id))) changed = wcscmp(id, s->device_id) != 0;
  CoTaskMemFree(id); if (device) IMMDevice_Release(device);
  return changed;
}
int main(int argc, char **argv) {
  for (unsigned i = 0; i < FFT_SIZE; i++) window[i] = .42 - .5 * cos(2 * PI * i / FFT_SIZE) + .08 * cos(4 * PI * i / FFT_SIZE);
  if (argc == 2 && !strcmp(argv[1], "--self-test")) {
    const double tones[] = {0, 80, 180, 500, 2000, 6000, 12000};
    for (unsigned t = 0; t < 7; t++) {
      reset_samples();
      for (unsigned i = 0; i < FFT_SIZE; i++) push_sample(tones[t] ? .25 * sin(2 * PI * tones[t] * i / 48000) : 0);
      emit_frame(48000, 1, tones[t]);
    }
    return 0;
  }
  if (argc != 1) return 2;
  if (FAILED(CoInitializeEx(NULL, COINIT_MULTITHREADED))) return 3;
  Capture session = {0}; ULONGLONG next_open = 0, next_frame = 0, next_device = 0, last_packet = 0;
  while (parent_alive()) {
    ULONGLONG now = GetTickCount64();
    if (!session.capture && now >= next_open) {
      HRESULT hr = open_capture(&session);
      if (FAILED(hr)) {
        printf("{\"type\":\"error\",\"code\":\"0x%08lx\"}\n", (unsigned long)hr); fflush(stdout);
        close_capture(&session); next_open = now + 1000;
      } else { next_device = now + 1000; last_packet = now; }
    }
    if (session.capture) {
      int received; HRESULT hr = drain(&session, &received);
      if (FAILED(hr) || (now >= next_device && device_changed(&session))) {
        close_capture(&session); next_open = now; continue;
      }
      if (now >= next_device) next_device = now + 1000;
      if (received) last_packet = now;
      // WASAPI can stop delivering packets when every application is silent.
      if (now - last_packet > 100) reset_samples();
      if (now >= next_frame) { emit_frame(session.format->nSamplesPerSec, 0, 0); next_frame = now + 33; }
    }
    Sleep(5);
  }
  close_capture(&session); CoUninitialize(); return 0;
}
