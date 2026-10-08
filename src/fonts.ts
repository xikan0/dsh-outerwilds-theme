import jost from './assets/fonts/Jost-Variable.ttf';
import jostItalic from './assets/fonts/Jost-Italic-Variable.ttf';
import sourceHanSans from './assets/fonts/SourceHanSansCN-Variable.woff2';

// Embed the official, unmodified font files so both clients work offline.
export const fontFaces = `
@font-face {
  font-family: 'DSH Outer Wilds Jost';
  src: url('${jost}') format('truetype');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'DSH Outer Wilds Jost';
  src: url('${jostItalic}') format('truetype');
  font-weight: 100 900;
  font-style: italic;
  font-display: swap;
}
@font-face {
  font-family: 'DSH Outer Wilds Source Han Sans CN';
  src: url('${sourceHanSans}') format('woff2');
  font-weight: 250 900;
  font-style: normal;
  font-display: swap;
}
`;
