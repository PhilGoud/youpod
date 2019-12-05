(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.FontPicker = factory());
}(this, function () { 'use strict';

  /*! *****************************************************************************
  Copyright (c) Microsoft Corporation. All rights reserved.
  Licensed under the Apache License, Version 2.0 (the "License"); you may not use
  this file except in compliance with the License. You may obtain a copy of the
  License at http://www.apache.org/licenses/LICENSE-2.0

  THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
  WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
  MERCHANTABLITY OR NON-INFRINGEMENT.

  See the Apache Version 2.0 License for specific language governing permissions
  and limitations under the License.
  ***************************************************************************** */

  function __rest(s, e) {
      var t = {};
      for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
          t[p] = s[p];
      if (s != null && typeof Object.getOwnPropertySymbols === "function")
          for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
              if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                  t[p[i]] = s[p[i]];
          }
      return t;
  }

  function __awaiter(thisArg, _arguments, P, generator) {
      return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
          function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
          function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
  }

  function getFontId(fontFamily) {
      return fontFamily.replace(/\s+/g, "-").toLowerCase();
  }
  function validatePickerId(pickerId) {
      if (pickerId.match(/[^0-9a-z]/i)) {
          throw Error("The `pickerId` parameter may only contain letters and digits");
      }
  }

  function get(url) {
      return new Promise((resolve, reject) => {
          const request = new XMLHttpRequest();
          request.overrideMimeType("application/json");
          request.open("GET", url, true);
          request.onreadystatechange = () => {
              if (request.readyState === 4) {
                  if (request.status !== 200) {
                      reject(new Error(`Response has status code ${request.status}`));
                  }
                  else {
                      resolve(request.responseText);
                  }
              }
          };
          request.send();
      });
  }

  const LIST_BASE_URL = "https://www.googleapis.com/webfonts/v1/webfonts";
  function getFontList(apiKey) {
      return __awaiter(this, void 0, void 0, function* () {
          const url = new URL(LIST_BASE_URL);
          url.searchParams.append("sort", "popularity");
          url.searchParams.append("key", apiKey);
          const response = yield get(url.href);
          const json = JSON.parse(response);
          const fontsOriginal = json.items;
          return fontsOriginal.map((fontOriginal) => {
              const { family, subsets } = fontOriginal, others = __rest(fontOriginal, ["family", "subsets"]);
              return Object.assign(Object.assign({}, others), { family, id: getFontId(family), scripts: subsets });
          });
      });
  }

  const previewFontsStylesheet = document.createElement("style");
  document.head.appendChild(previewFontsStylesheet);
  function applyFontPreview(previewFont, selectorSuffix) {
      const fontId = getFontId(previewFont.family);
      const style = `
			#font-button-${fontId}${selectorSuffix} {
				font-family: "${previewFont.family}";
			}
		`;
      previewFontsStylesheet.appendChild(document.createTextNode(style));
  }
  function getActiveFontStylesheet(selectorSuffix) {
      const stylesheetId = `active-font-${selectorSuffix}`;
      let activeFontStylesheet = document.getElementById(stylesheetId);
      if (!activeFontStylesheet) {
          activeFontStylesheet = document.createElement("style");
          activeFontStylesheet.id = stylesheetId;
          document.head.appendChild(activeFontStylesheet);
      }
      return activeFontStylesheet;
  }
  function applyActiveFont(activeFont, previousFontFamily, selectorSuffix) {
      const style = `
		.apply-font${selectorSuffix} {
			font-family: "${activeFont.family}"${previousFontFamily ? `, "${previousFontFamily}"` : ""};
		}
	`;
      const activeFontStylesheet = getActiveFontStylesheet(selectorSuffix);
      activeFontStylesheet.innerHTML = style;
  }

  const PREVIEW_ATTRIBUTE_NAME = "data-is-preview";
  function getStylesheetId(fontId) {
      return `font-${fontId}`;
  }
  function stylesheetExists(fontId, isPreview) {
      const stylesheetNode = document.getElementById(getStylesheetId(fontId));
      if (isPreview === null || isPreview === undefined) {
          return stylesheetNode !== null;
      }
      return (stylesheetNode !== null &&
          stylesheetNode.getAttribute(PREVIEW_ATTRIBUTE_NAME) === isPreview.toString());
  }
  function createStylesheet(fontId, isPreview) {
      const stylesheetNode = document.createElement("style");
      stylesheetNode.id = getStylesheetId(fontId);
      stylesheetNode.setAttribute(PREVIEW_ATTRIBUTE_NAME, isPreview.toString());
      document.head.appendChild(stylesheetNode);
  }
  function fillStylesheet(fontId, styles) {
      const stylesheetId = getStylesheetId(fontId);
      const stylesheetNode = document.getElementById(stylesheetId);
      if (stylesheetNode) {
          stylesheetNode.textContent = styles;
      }
      else {
          console.error(`Could not fill stylesheet: Stylesheet with ID "${stylesheetId}" not found`);
      }
  }
  function setStylesheetType(fontId, isPreview) {
      const stylesheetId = getStylesheetId(fontId);
      const stylesheetNode = document.getElementById(stylesheetId);
      if (stylesheetNode) {
          stylesheetNode.setAttribute(PREVIEW_ATTRIBUTE_NAME, isPreview.toString());
      }
      else {
          console.error(`Could not change stylesheet type: Stylesheet with ID "${stylesheetId}" not found`);
      }
  }

  function getMatches(regex, str) {
      const matches = [];
      let match;
      do {
          match = regex.exec(str);
          if (match) {
              matches.push(match[1]);
          }
      } while (match);
      return matches;
  }

  const FONT_FACE_REGEX = /@font-face {([\s\S]*?)}/gm;
  const FONT_FAMILY_REGEX = /font-family: ['"](.*?)['"]/gm;
  function extractFontStyles(allFontStyles) {
      const rules = getMatches(FONT_FACE_REGEX, allFontStyles);
      const fontStyles = {};
      rules.forEach((rule) => {
          const fontFamily = getMatches(FONT_FAMILY_REGEX, rule)[0];
          const fontId = getFontId(fontFamily);
          if (!(fontId in fontStyles)) {
              fontStyles[fontId] = "";
          }
          fontStyles[fontId] += `@font-face {\n${rule}\n}\n\n`;
      });
      return fontStyles;
  }

  const FONT_BASE_URL = "https://fonts.googleapis.com/css";
  function getStylesheet(fonts, scripts, variants, previewsOnly) {
      return __awaiter(this, void 0, void 0, function* () {
          const url = new URL(FONT_BASE_URL);
          const variantsStr = variants.join(",");
          const familiesStr = fonts.map((font) => `${font.family}:${variantsStr}`);
          url.searchParams.append("family", familiesStr.join("|"));
          url.searchParams.append("subset", scripts.join(","));
          if (previewsOnly) {
              const familyNamesConcat = fonts.map((font) => font.family).join("");
              const downloadChars = familyNamesConcat
                  .split("")
                  .filter((char, pos, self) => self.indexOf(char) === pos)
                  .join("");
              url.searchParams.append("text", downloadChars);
          }
          url.searchParams.append("font-display", "swap");
          return get(url.href);
      });
  }

  function loadFontPreviews(fonts, scripts, variants, selectorSuffix) {
      return __awaiter(this, void 0, void 0, function* () {
          const fontsArray = Array.from(fonts.values());
          const fontsToFetch = fontsArray
              .map((font) => font.id)
              .filter((fontId) => !stylesheetExists(fontId));
          fontsToFetch.forEach((fontId) => createStylesheet(fontId, true));
          const response = yield getStylesheet(fontsArray, scripts, variants, true);
          const fontStyles = extractFontStyles(response);
          fontsArray.forEach((font) => {
              applyFontPreview(font, selectorSuffix);
              if (fontsToFetch.includes(font.id)) {
                  if (!(font.id in fontStyles)) {
                      console.error(`Missing styles for font "${font.family}" (fontId "${font.id}") in Google Fonts response`);
                      return;
                  }
                  fillStylesheet(font.id, fontStyles[font.id]);
              }
          });
      });
  }
  function loadActiveFont(font, previousFontFamily, scripts, variants, selectorSuffix) {
      return __awaiter(this, void 0, void 0, function* () {
          if (stylesheetExists(font.id, false)) {
              applyActiveFont(font, previousFontFamily, selectorSuffix);
          }
          else {
              if (stylesheetExists(font.id, true)) {
                  setStylesheetType(font.id, false);
              }
              else {
                  createStylesheet(font.id, false);
              }
              const fontStyle = yield getStylesheet([font], scripts, variants, false);
              applyActiveFont(font, previousFontFamily, selectorSuffix);
              fillStylesheet(font.id, fontStyle);
          }
      });
  }

  function styleInject(css, ref) {
    if ( ref === void 0 ) ref = {};
    var insertAt = ref.insertAt;

    if (!css || typeof document === 'undefined') { return; }

    var head = document.head || document.getElementsByTagName('head')[0];
    var style = document.createElement('style');
    style.type = 'text/css';

    if (insertAt === 'top') {
      if (head.firstChild) {
        head.insertBefore(style, head.firstChild);
      } else {
        head.appendChild(style);
      }
    } else {
      head.appendChild(style);
    }

    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
  }

  var css = "@charset \"UTF-8\";\ndiv[id^=font-picker] {\n  position: relative;\n  display: inline-block;\n  width: 100%;\n }\ndiv[id^=font-picker] * {\n  box-sizing: border-box;\n}\ndiv[id^=font-picker] p {\n  margin: 0;\n  padding: 0;\n}\ndiv[id^=font-picker] button {\n  color: inherit;\n  font-size: inherit;\n  background: none;\n  border: 0;\n  outline: none;\n  cursor: pointer;\n}\ndiv[id^=font-picker] .dropdown-button {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  width: 100%;\n  height: 35px;\n  padding: 0 10px;\n  background: #ffffff;\n border-radius:0.25rem;\n border: 1px solid #ced4da;\n}\ndiv[id^=font-picker] .dropdown-button:hover, div[id^=font-picker] .dropdown-button:focus {\n  background: #ffffff;\n}\ndiv[id^=font-picker] .dropdown-button .dropdown-font-name {\n  overflow: hidden;\n  white-space: nowrap;\n}\ndiv[id^=font-picker] .dropdown-icon {\n  margin-left: 10px;\n}\n@-webkit-keyframes spinner {\n  to {\n    transform: rotate(360deg);\n  }\n}\n@keyframes spinner {\n  to {\n    transform: rotate(360deg);\n  }\n}\ndiv[id^=font-picker] .dropdown-icon.loading::before {\n  display: block;\n  width: 10px;\n  height: 10px;\n  border: 2px solid #b2b2b2;\n  border-top-color: #000000;\n  border-radius: 50%;\n  -webkit-animation: spinner 0.6s linear infinite;\n          animation: spinner 0.6s linear infinite;\n  content: \"\";\n}\ndiv[id^=font-picker] .dropdown-icon.finished::before {\n  display: block;\n  width: 0;\n  height: 0;\n  margin: 0 2px;\n  border-top: 6px solid #000000;\n  border-right: 5px solid transparent;\n  border-left: 5px solid transparent;\n  transition: transform 0.3s;\n  content: \"\";\n}\ndiv[id^=font-picker] .dropdown-icon.error::before {\n  content: \"⚠\";\n}\ndiv[id^=font-picker].expanded .dropdown-icon.finished::before {\n  transform: rotate(-180deg);\n}\ndiv[id^=font-picker].expanded ul {\n  max-height: 300px;\n}\ndiv[id^=font-picker] ul {\n  position: absolute;\n  z-index: 1;\n  width: 100%;\n  max-height: 0;\n  margin: 0;\n  padding: 0;\n  overflow-x: hidden;\n  overflow-y: auto;\n  background: #ffffff;\n  box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.2);\n  transition: 0.3s;\n  -webkit-overflow-scrolling: touch;\n}\ndiv[id^=font-picker] ul li {\n  height: 35px;\n  list-style: none;\n}\ndiv[id^=font-picker] ul li button {\n  display: flex;\n  align-items: center;\n  width: 100%;\n  height: 100%;\n  padding: 0 10px;\n  white-space: nowrap;\n}\ndiv[id^=font-picker] ul li button:hover, div[id^=font-picker] ul li button:focus {\n  background: #dddddd;\n}\ndiv[id^=font-picker] ul li button.active-font {\n  background: #d1d1d1;\n}";
  styleInject(css);

  const FONT_FAMILY_DEFAULT = "Open Sans";
  const OPTIONS_DEFAULTS = {
      pickerId: "",
      families: [],
      categories: [],
      scripts: ["latin"],
      variants: ["regular"],
      limit: 50,
      sort: "alphabet",
  };

  class FontManager {
      constructor(apiKey, defaultFamily = FONT_FAMILY_DEFAULT, { pickerId = OPTIONS_DEFAULTS.pickerId, families = OPTIONS_DEFAULTS.families, categories = OPTIONS_DEFAULTS.categories, scripts = OPTIONS_DEFAULTS.scripts, variants = OPTIONS_DEFAULTS.variants, limit = OPTIONS_DEFAULTS.limit, sort = OPTIONS_DEFAULTS.sort, }, onChange = () => { }) {
          this.fonts = new Map();
          validatePickerId(pickerId);
          this.selectorSuffix = pickerId ? `-${pickerId}` : "";
          this.apiKey = apiKey;
          this.options = {
              pickerId,
              families,
              categories,
              scripts,
              variants,
              limit,
              sort,
          };
          this.onChange = onChange;
          this.addFont(defaultFamily, false);
          this.setActiveFont(defaultFamily, false);
      }
      init() {
          return __awaiter(this, void 0, void 0, function* () {
              const fonts = yield getFontList(this.apiKey);
              for (let i = 0; i < fonts.length; i += 1) {
                  const font = fonts[i];
                  if (this.fonts.size >= this.options.limit) {
                      break;
                  }
                  if (!this.fonts.has(font.family) &&
                      (this.options.families.length === 0 || this.options.families.includes(font.family)) &&
                      (this.options.categories.length === 0 || this.options.categories.includes(font.category)) &&
                      this.options.scripts.every((script) => font.scripts.includes(script)) &&
                      this.options.variants.every((variant) => font.variants.includes(variant))) {
                      this.fonts.set(font.family, font);
                  }
              }
              const fontsToLoad = new Map(this.fonts);
              fontsToLoad.delete(this.activeFontFamily);
              loadFontPreviews(fontsToLoad, this.options.scripts, this.options.variants, this.selectorSuffix);
              return this.fonts;
          });
      }
      getFonts() {
          return this.fonts;
      }
      addFont(fontFamily, downloadPreview = true) {
          const font = {
              family: fontFamily,
              id: getFontId(fontFamily),
          };
          this.fonts.set(fontFamily, font);
          if (downloadPreview) {
              const fontMap = new Map();
              fontMap.set(fontFamily, font);
              loadFontPreviews(fontMap, this.options.scripts, this.options.variants, this.selectorSuffix);
          }
      }
      removeFont(fontFamily) {
          this.fonts.delete(fontFamily);
      }
      getActiveFont() {
          const activeFont = this.fonts.get(this.activeFontFamily);
          if (!activeFont) {
              throw Error(`Cannot get active font: "${this.activeFontFamily}" is not in the font list`);
          }
          else {
              return activeFont;
          }
      }
      setActiveFont(fontFamily, runOnChange = true) {
          const previousFontFamily = this.activeFontFamily;
          const activeFont = this.fonts.get(fontFamily);
          if (!activeFont) {
              throw Error(`Cannot update active font: "${fontFamily}" is not in the font list`);
          }
          this.activeFontFamily = fontFamily;
          loadActiveFont(activeFont, previousFontFamily, this.options.scripts, this.options.variants, this.selectorSuffix).then(() => {
              if (runOnChange) {
                  this.onChange(activeFont);
              }
          });
      }
      setOnChange(onChange) {
          this.onChange = onChange;
      }
  }

  var FontPicker = (function () {
      function FontPicker(apiKey, defaultFamily, _a, onChange) {
          if (defaultFamily === void 0) { defaultFamily = FONT_FAMILY_DEFAULT; }
          var _b = _a.pickerId, pickerId = _b === void 0 ? OPTIONS_DEFAULTS.pickerId : _b, _c = _a.families, families = _c === void 0 ? OPTIONS_DEFAULTS.families : _c, _d = _a.categories, categories = _d === void 0 ? OPTIONS_DEFAULTS.categories : _d, _e = _a.scripts, scripts = _e === void 0 ? OPTIONS_DEFAULTS.scripts : _e, _f = _a.variants, variants = _f === void 0 ? OPTIONS_DEFAULTS.variants : _f, _g = _a.limit, limit = _g === void 0 ? OPTIONS_DEFAULTS.limit : _g, _h = _a.sort, sort = _h === void 0 ? OPTIONS_DEFAULTS.sort : _h;
          if (onChange === void 0) { onChange = function () { }; }
          this.expanded = false;
          this.closeEventListener = this.closeEventListener.bind(this);
          this.toggleExpanded = this.toggleExpanded.bind(this);
          var options = {
              pickerId: pickerId,
              families: families,
              categories: categories,
              scripts: scripts,
              variants: variants,
              limit: limit,
              sort: sort,
          };
          this.fontManager = new FontManager(apiKey, defaultFamily, options, onChange);
          this.generateUI(sort);
      }
      FontPicker.prototype.generateUI = function (sort) {
          var _this = this;
          var selectorSuffix = this.fontManager.selectorSuffix;
          var pickerId = "font-picker" + selectorSuffix;
          this.fontPickerDiv = document.getElementById(pickerId);
          if (!this.fontPickerDiv) {
              throw Error("Missing div with id=\"" + pickerId + "\"");
          }
          var dropdownButton = document.createElement("button");
          dropdownButton.classList.add("dropdown-button");
          dropdownButton.onclick = this.toggleExpanded;
          dropdownButton.onkeypress = this.toggleExpanded;
          dropdownButton.type = "button";
          this.fontPickerDiv.appendChild(dropdownButton);
          this.dropdownFamily = document.createElement("p");
          this.dropdownFamily.textContent = this.fontManager.getActiveFont().family;
          this.dropdownFamily.classList.add("dropdown-font-family");
          dropdownButton.appendChild(this.dropdownFamily);
          var dropdownIcon = document.createElement("p");
          dropdownIcon.classList.add("dropdown-icon", "loading");
          dropdownButton.appendChild(dropdownIcon);
          this.fontManager
              .init()
              .then(function (fontMap) {
              var fonts = Array.from(fontMap.values());
              if (sort === "alphabet") {
                  fonts.sort(function (font1, font2) {
                      return font1.family.localeCompare(font2.family);
                  });
              }
              _this.generateFontList(fonts);
              dropdownIcon.classList.replace("loading", "finished");
          })["catch"](function (err) {
              dropdownIcon.classList.replace("loading", "error");
              console.error("Error trying to fetch the list of available fonts");
              console.error(err);
          });
      };
      FontPicker.prototype.generateFontList = function (fonts) {
          var _this = this;
          this.ul = document.createElement("ul");
          this.ul.classList.add("font-list");
          fonts.forEach(function (font) {
              _this.addFontLi(font);
          });
          this.fontPickerDiv.appendChild(this.ul);
          var activeFontFamily = this.fontManager.getActiveFont().family;
          var activeFontId = getFontId(activeFontFamily);
          var fontButtonId = "font-button-" + activeFontId + this.fontManager.selectorSuffix;
          this.activeFontButton = document.getElementById(fontButtonId);
          if (this.activeFontButton) {
              this.activeFontButton.classList.add("active-font");
          }
          else {
              console.error("Could not find font button with ID (" + fontButtonId + ")");
          }
      };
      FontPicker.prototype.addFontLi = function (font, listIndex) {
          var _this = this;
          var fontId = getFontId(font.family);
          var li = document.createElement("li");
          li.classList.add("font-list-item");
          var fontButton = document.createElement("button");
          fontButton.type = "button";
          fontButton.id = "font-button-" + fontId + this.fontManager.selectorSuffix;
          fontButton.classList.add("font-button");
          fontButton.textContent = font.family;
          var onActivate = function () {
              _this.toggleExpanded();
              _this.setActiveFont(font.family);
          };
          fontButton.onclick = onActivate;
          fontButton.onkeypress = onActivate;
          li.appendChild(fontButton);
          if (listIndex) {
              this.ul.insertBefore(li, this.ul.children[listIndex]);
          }
          else {
              this.ul.appendChild(li);
          }
      };
      FontPicker.prototype.closeEventListener = function (e) {
          var targetEl = e.target;
          var fontPickerEl = document.getElementById("font-picker" + this.fontManager.selectorSuffix);
          while (true) {
              if (targetEl === fontPickerEl) {
                  return;
              }
              if (targetEl.parentNode) {
                  targetEl = targetEl.parentNode;
              }
              else {
                  this.toggleExpanded();
                  return;
              }
          }
      };
      FontPicker.prototype.toggleExpanded = function () {
          if (this.expanded) {
              this.expanded = false;
              this.fontPickerDiv.classList.remove("expanded");
              document.removeEventListener("click", this.closeEventListener);
          }
          else {
              this.expanded = true;
              this.fontPickerDiv.classList.add("expanded");
              document.addEventListener("click", this.closeEventListener);
          }
      };
      FontPicker.prototype.getFonts = function () {
          return this.fontManager.getFonts();
      };
      FontPicker.prototype.addFont = function (fontFamily, index) {
          if (Array.from(this.fontManager.getFonts().keys()).includes(fontFamily)) {
              throw Error("Did not add font to font picker: Font family \"" + fontFamily + "\" is already in the list");
          }
          this.fontManager.addFont(fontFamily, true);
          var font = this.fontManager.getFonts().get(fontFamily);
          if (font) {
              this.addFontLi(font, index);
          }
          else {
              console.error("Font \"" + fontFamily + "\" is missing in font list");
          }
      };
      FontPicker.prototype.removeFont = function (fontFamily) {
          this.fontManager.removeFont(fontFamily);
          var fontId = getFontId(fontFamily);
          var fontButton = document.getElementById("font-button-" + fontId + this.fontManager.selectorSuffix);
          if (fontButton) {
              var fontLi = fontButton.parentElement;
              fontButton.remove();
              if (fontLi) {
                  fontLi.remove();
              }
          }
          else {
              throw Error("Could not remove font from font picker: Font family \"" + fontFamily + "\" is not in the list");
          }
      };
      FontPicker.prototype.getActiveFont = function () {
          return this.fontManager.getActiveFont();
      };
      FontPicker.prototype.setActiveFont = function (fontFamily) {
          this.fontManager.setActiveFont(fontFamily);
          var fontId = getFontId(fontFamily);
          this.dropdownFamily.textContent = fontFamily;
          if (this.activeFontButton) {
              this.activeFontButton.classList.remove("active-font");
              this.activeFontButton = document.getElementById("font-button-" + fontId + this.fontManager.selectorSuffix);
              this.activeFontButton.classList.add("active-font");
          }
          else {
              console.error("`activeFontButton` is undefined");
          }
      };
      FontPicker.prototype.setOnChange = function (onChange) {
          this.fontManager.setOnChange(onChange);
      };
      return FontPicker;
  }());

  return FontPicker;

}));
