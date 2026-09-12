/** Мини-обёртка вокруг DOMParser для удобной навигации по OOXML. */

export class XmlElement {
  constructor(
    public readonly name: string,
    public readonly attributes: Record<string, string>,
    public readonly children: XmlElement[],
    public readonly textContent: string,
  ) {}

  attr(name: string): string | undefined {
    return this.attributes[name];
  }

  attrNum(name: string): number | null {
    const v = this.attributes[name];
    if (v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  /** Первый прямой дочерний элемент с локальным именем. */
  child(name: string): XmlElement | undefined {
    return this.children.find((c) => c.name === name);
  }

  /** Все прямые дочерние элементы с локальным именем. */
  childrenByName(name: string): XmlElement[] {
    return this.children.filter((c) => c.name === name);
  }

  /** Поиск по всему поддереву (в глубину). */
  descendants(name: string): XmlElement[] {
    const out: XmlElement[] = [];
    const walk = (el: XmlElement) => {
      for (const c of el.children) {
        if (c.name === name) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }

  get text(): string {
    return this.textContent;
  }
}

function parseLocalName(qualifiedName: string): string {
  const idx = qualifiedName.indexOf(":");
  return idx === -1 ? qualifiedName : qualifiedName.slice(idx + 1);
}

export function parseXml(xml: string): XmlElement | null {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const err = doc.querySelector("parsererror");
  if (err) {
    throw new Error(`Ошибка разбора XML: ${err.textContent ?? "unknown"}`);
  }
  const root = doc.documentElement;
  if (!root) return null;

  const build = (node: Element): XmlElement => {
    const children: XmlElement[] = [];
    let direct = "";
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        children.push(build(child as Element));
      } else if (child.nodeType === Node.TEXT_NODE) {
        direct += (child as Text).data;
      }
    }
    const attributes: Record<string, string> = {};
    for (let i = 0; i < node.attributes.length; i++) {
      const a = node.attributes[i];
      attributes[parseLocalName(a.name)] = a.value;
    }
    // textContent — весь текст поддерева (прямой + дочерних элементов)
    const text = direct + children.map((c) => c.textContent).join("");
    return new XmlElement(parseLocalName(node.nodeName), attributes, children, text);
  };

  return build(root);
}
