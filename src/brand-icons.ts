import eye from './assets/eye.svg';
import giantsDeep from './assets/giants-deep.svg';

// Base64 keeps SVG attribute quotes from terminating the CSS url() string.
// Embedded masks inherit the theme colour without changing host SVGs or actions.
export const brandIconVariables = `body[data-dsh-campfire] {
  --cf-eye-icon: url("data:image/svg+xml;base64,${eye}");
  --cf-giants-deep-icon: url("data:image/svg+xml;base64,${giantsDeep}");
}`;
