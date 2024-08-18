!(function ( // IIFE to encapsulate all code
  // ====================================================================== GLOBAL DOM HELPER FUNCTIONS
  // ------------------------------------------------------------------------ create any <tag>
  createElement = (tag, props = {}, children = []) => {
    const el = document.createElement(tag); // create element
    el.append(...children); // append all children
    return Object.assign(el, props); // assign all properties & methods
  }
) {
  // ************************************************************************** define <highlight-editor>
  customElements.define("highlight-editor", class extends HTMLElement {
    constructor() {
      // ====================================================================== DOM HELPER FUNCTIONS
      // ---------------------------------------------------------------------- create <TEXTAREA>
      // create a <textarea> wrapped in a <div>
      // defined within constructor so the lexical this scope can be used
      const createTEXTAREA = (
        ref, // ref = "html", "css", "js"
        placeholder = ""
      ) => {
        return createElement("div", { id: ref + "container" }, [
          // create this.html, this.css, this.js references
          this[ref] = createElement("textarea", {
            placeholder,
            // listeners on <textarea>
            oninput: () => this.iframe(), // update iframe on input
            // oldonkeydown: (evt) => {
            //   if (evt.key == "Tab") {
            //     evt.preventDefault();
            //     const TAB_SIZE = 2;
            //     console.log("Tab pressed", this[ref]);
            //     // execCommand is deprecated, but still works just fine!
            //     document.execCommand("insertText", false, " ".repeat(TAB_SIZE));
            //   }
            // },
            onkeydown: (evt) => {
              if (evt.key == "Tab") {
                evt.preventDefault();
                const TAB_SIZE = 2;
                const textarea = evt.target;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                // Insert the tab spaces at the cursor's position
                const tabSpaces = " ".repeat(TAB_SIZE);
                textarea.value = textarea.value.slice(0, start) + tabSpaces + textarea.value.slice(end);
                // Move the cursor after the inserted tab spaces
                textarea.selectionStart = textarea.selectionEnd = start + TAB_SIZE;
              }
            }

          }) // end <textarea> properties & methods
        ]); // end <div> 
      } // end createTEXTAREA()

      // ====================================================================== MAIN - create shadowDOM
      super()
        .attachShadow({
          mode: "open"
        })
        .append(
          createElement("style", {
            innerHTML:
              // VSCode extension "literally-html" will syntax highlight template literal strings as HTML or CSS
              /*css*/`:host{
  display:flex;width:100%;height:100%;container-type:inline-size
}
#container{
  display:flex;width:100%;height:70vh
}
#editor{
  display:flex;flex-direction:column;width:50%;height:100%;background:#1d1d1d;resize:horizontal;overflow:auto
}
#editor div:last-child{
  flex-grow:1
}
#output{
  display:flex;background:white;flex-grow:1;overflow:auto
}
#htmlcontainer, #csscontainer, #jscontainer{
  display:flex;height:calc(100%/3);position:relative;padding:8px;resize:vertical;overflow:auto
}
textarea{
  width:100%;height:100%;box-sizing:border-box;margin:0;padding:4px;background-color:black;border-radius:4px;
  color:#f1f1f1;line-height:1.4;resize:none;overflow:auto;white-space:pre;
  font-family:"Monaspace", monospace;font-feature-settings:"colr", "calt"
}
iframe{
  border:none;flex:1
}
button{
  position:absolute;bottom:14px;right:14px;padding:4px 8px;border-radius:2px;cursor:pointer;background-color:#d1d1d1;color:#1d1d1d;opacity:0.6
}
button:hover{
  opacity:1
}
@container (max-width:900px){
  #container{flex-direction:column}
  #editor{width:100%;height:50%;resize:vertical}
}`,
          }),// end <style> in shadowDOM
          // -------------------------------------------------------------------- create more shadowDOM
          this.container = createElement("div", { id: "container" }, [
            this.editor = createElement("div", { id: "editor" }, [
              createTEXTAREA(/* ref: */"html", /* placeholder: */"Enter HTML here..."),
              createTEXTAREA("css", "Enter CSS here..."),
              createTEXTAREA("js", "Enter JavaScript here..."),
            ]),
            createElement("div", { id: "output" }, [
              this.iframe = createElement("iframe")
            ])
          ])
        );// end append() in shadowDOM
      // ---------------------------------------------------------------------- end create shadowDOM

      // ====================================================================== Add FONT-FACE to main document
      if (document.querySelector("#Monaspace")) return; // return if it exists
      // NOTE: font-face always has to be in the Global scope, so it's not possible to put it inside the shadowRoot.
      // font related CSS properties can be used inside the shadowRoot, they are "inheritable styles" that trickle into shadowDOM
      document.head.append(createElement("style", {
        id: "Monaspace",
        innerHTML: "@font-face{" +
          "font-family:'Monaspace';" +
          "src:url('MonaspaceSyntaxHighlighter.woff2') format('woff2');" +
          "font-weight:normal;font-style:normal}"
      }));
    } // end constructor

    // ======================================================================== connectedCallback 
    connectedCallback() {
      // ---------------------------------------------------------------------- EVENT LISTENERS
      let resizer = () => {
        //css resize sets height and width INLINE, so we need to clear them if user resizes the window
        this.editor.style[this.container.offsetWidth < 900 ? "width" : "height"] = "";
      }
      window.addEventListener("resize", resizer);
      // prepare remove event listener function
      this.removeresizer = () => window.removeEventListener("resize", resizer);

      // ---------------------------------------------------------------------- wait for innerHTML to be parsed
      setTimeout(() => {
        this.template2textareas(); // parse <template> HTML, CSS or JS content to <textarea>
        this.iframe();
      });
    }// connectedCallback
    // ======================================================================== disconnectedCallback 
    disconnectedCallback() {
      // clean up Eventlisteners defined outside Web Component scope
      this.removeresizer();
    }

    // ======================================================================== lightDOM to: <textarea>
    // process the lightDOM <template>, remove unwanted indentation, and set <textarea>.values
    template2textareas() {
      let blocks = {
        style: "",
        script: "",
        html: ""
      }
      let template = this.querySelector("template");
      if (template) {
        // store all <style> and <script> content in blocks.style and blocks.script
        template.content.querySelectorAll("style,script").forEach(el => {
          blocks[el.localName] += el.innerHTML; // store <style> and <script> content
          el.remove(); // remove <style> and <script> from <template>; HTML remains
        });
        const indentFunc = (str) => {
          str = createElement("textarea", { innerHTML: str }).value; // temp <textarea> to decode HTML entities in str
          // now remove all unwanted indentation, but maintain code indentation
          let lines = str.split("\n");
          let code = lines // Return the array of lines after processing as one code string (ChatGPT helped)
            .map(l => l.slice(Math.min(                 // For each line, remove the minimum leading whitespace
              ...lines                                  // Spread the array of minimum leading whitespace lengths
                .filter(l => l.trim())                  // Filter out any empty or whitespace-only lines
                .map(l => l.match(/^[ \t]*/)[0].length) // Extract the length of leading whitespace (tabs/spaces)
            )))                                         // `Math.min` gives the smallest leading whitespace length, which is removed from each line
            .join("\n")                                 // join lines with line-breaks to one String
            .replace(/^\s*\n/, "");                     // remove leading empty lines
          //console.log(code);
          return code;
        }
        // remove all unwanted indentation, but maintain code indentation
        this.css.value = indentFunc(blocks.style);
        this.js.value = indentFunc(blocks.script);
        this.html.value = indentFunc(template.innerHTML);
      }
    } // template2textareas()

    // ======================================================================== output to <IFRAME>
    iframe(
      doc = this.iframe.contentDocument
    ) {
      doc.open();
      doc.write(
        this.html.value +
        "<style>" + this.css.value + "</style>" +
        "<script>" + this.js.value + "</script>"
      );
      doc.close();
    } // setIFrame()

  }); // defined custom element <highlight-editor>

}());// end IIFE, code can safely be inserted in any other code