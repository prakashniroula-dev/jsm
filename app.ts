import { useDynamicCss } from './lib/hooks';
import { Jsm, useState, useCss, Input, useEffect, useRef, Span, Div } from './lib/jsm';


function getContrastYIQ(hexcolor: string) {
  hexcolor = hexcolor.replace("#", "");
  const r = parseInt(hexcolor.substring(0, 2), 16);
  const g = parseInt(hexcolor.substring(2, 4), 16);
  const b = parseInt(hexcolor.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? 'black' : 'white';
}

function App() {  

  useCss(`
    & {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      justify-content: center;
      font-family: Arial, sans-serif;
      max-width: 600px;
      border: 1px solid #ccc;
      padding: 20px;
      border-radius: 10px;
    }
  `);

  const v = useState("#ffffff");
  useDynamicCss(`& { background-color: ${v.value}; color: ${getContrastYIQ(v.value)}; }`);

  return Div(
    {className: `app-container-${v.value.replace("#", "")}`},
    Span("Current color: ", v.value),
    "Hello World",
    Input({type: 'color', value: v.value, onInput: (e: InputEvent) => v.value = (e.target as HTMLInputElement).value}),
    Div("Hi there !")
  );
}

export default Jsm(App);