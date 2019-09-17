import { JSDOM } from "jsdom";
import fs from "fs";

class Parser {
  constructor(fileName, metaFileName) {
    this.passages = [];
    this.readFile(fileName, metaFileName);
    this.parsePassages();
    this.parsePersonages();
    this.parseChapters();
    this.writeStoryJson();
  }

  // [[text|link]]
  allLinksRegexp = /\[\[(.*?)\|(.*?)\]\]/g;
  linkRegexp = /\[\[(.*?)\|(.*?)\]\]/;
  metaRegexp = /\{(.*?)\}/g;

  readFile = (fileName, metaFileName) => {
    const content = fs.readFileSync(fileName, "utf8");
    const dom = new JSDOM(content);
    this.storyData = dom.window.document.querySelector("tw-storydata");
    this.storyMeta = JSON.parse(fs.readFileSync(metaFileName, "utf8"));
  };

  parsePassages = () => {
    [...this.storyData.querySelectorAll("tw-passagedata")].map(
      this.parsePassage,
    );
  };

  parsePassage = passage => {
    const textContent = passage.textContent.replace(/\n/g, "");
    const linksNodes = textContent.match(this.allLinksRegexp);
    const meta = this.getMetaData(
      JSON.parse(textContent.match(this.metaRegexp)),
    );

    let links = [];
    if (linksNodes) {
      links = linksNodes.map(linkNode => {
        const differentName = linkNode.match(this.linkRegexp);

        // [[text|link]]
        return {
          text: differentName[1],
          passageId: differentName[2],
        };
      });
    }

    this.passages.push({
      ...meta,
      text: textContent
        .replace(this.allLinksRegexp, "")
        .replace(this.metaRegexp, ""),
      links,
      chapterNumber: +passage.getAttribute("tags"),
      id: passage.getAttribute("name"),
    });
  };

  getMetaData = ({
    isIncome = false,
    isSecondaryPersonage = false,
    type = "text",
    time = "",
    fromName = "",
  }) => {
    return { isSecondaryPersonage, isIncome, type, time, fromName };
  };

  parsePersonages = () => {
    this.primaryPersonages = new Set();
    this.passages = this.passages.map(passage => {
      const { fromName, isSecondaryPersonage } = passage;
      if (fromName && !isSecondaryPersonage) {
        this.primaryPersonages.add(fromName);
      }

      delete passage.isSecondaryPersonage;
      return passage;
    });
  };

  parseChapters = () => {
    this.chapters = this.storyMeta.chapters.map((chapter, i) => {
      const { name, storeProductId = "" } = chapter;
      const passages = this.passages
        .map(passage => {
          if (passage.chapterNumber === i + 1) {
            delete passage.chapterNumber;
            return passage;
          }
          return false;
        })
        .filter(passage => passage);

      const isFree =
        this.storyMeta.freeChaptersNumber.findIndex(item => item === i + 1) >
        -1;

      return {
        name,
        id: i,
        isFree,
        storeProductId,
        passages,
      };
    });
  };

  writeStoryJson = () => {
    const name = this.storyData.getAttribute("name");
    const startPassageId = this.storyData.getAttribute("startnode");
    const id = this.storyData.getAttribute("ifid");
    const story = {
      ...this.storyMeta,
      primaryPersonages: [...this.primaryPersonages],
      name,
      startPassageId,
      id,
      chapters: this.chapters,
    };

    delete story.freeChaptersNumber;

    fs.writeFile("output.json", JSON.stringify(story), err => {
      if (err) throw err;
      console.log("The file has been saved!");
    });
  };
}

new Parser("example/2.html", "example/story-meta.json");
