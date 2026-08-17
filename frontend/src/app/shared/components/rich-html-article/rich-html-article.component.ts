import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import createDOMPurify from 'dompurify';

const ALLOWED_FONT_ORIGINS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

const RICH_HTML_SANITIZE_CONFIG = {
  ADD_TAGS: ['style', 'link'],
  ADD_ATTR: ['rel', 'href', 'crossorigin'],
  // Designed articles have no legitimate need for interactive forms; a <form> rendered
  // inside the Shadow DOM would still submit to whatever origin its action points at
  // (the shadow boundary does not restrict form submission), which is a phishing surface
  // hosted on our own origin. Strip the whole family.
  FORBID_TAGS: ['form', 'input', 'button', 'textarea', 'select'],
  // Without this, DOMPurify's internal DOMParser().parseFromString(dirty, 'text/html')
  // auto-hoists the leading <link>/<style> tags into an implicit <head> (standard HTML5
  // fragment-parsing behavior), and DOMPurify's default (non-WHOLE_DOCUMENT) sanitize only
  // serializes the <body> subtree — silently dropping them. WHOLE_DOCUMENT: true makes it
  // serialize head+body together; the same ALLOWED_TAGS/hooks still apply to both. When the
  // resulting <html><head>…</head><body>…</body></html> string is assigned to
  // shadowRoot.innerHTML, the wrapper tags are discarded per HTML fragment-parsing rules and
  // only their children remain, so this does not change the shape of the rendered output.
  WHOLE_DOCUMENT: true,
};

function isAllowedFontOrigin(href: string | null): boolean {
  if (!href) {
    return false;
  }
  try {
    return ALLOWED_FONT_ORIGINS.includes(new URL(href).origin);
  } catch {
    return false;
  }
}

// The <link>-level origin whitelist only guards <link href="...">; CSS itself can load
// arbitrary remote resources via @import and url(...)-like functions (stylesheets, fonts,
// background images), both in <style> tag bodies and in inline style="" attributes. Neither
// is touched by DOMPurify (it doesn't parse CSS), so this closes that gap by stripping
// @import outright and neutralizing any absolute-URL token to keep only data: URIs and the
// same allowed font origins already enforced on <link>.
//
// CSS comments are stripped first: a comment between a function name and its argument
// (e.g. `url(/*c*/"...")`) would otherwise hide the URL from the passes below, and this
// also closes off comment-based obfuscation of `@import` itself (e.g. `@im/**/port`).
const CSS_COMMENT_RE = /\/\*[\s\S]*?\*\//g;
// `\b` (not `\s+`) because CSS syntax allows `@import` immediately followed by a string
// token with zero whitespace, e.g. `@import"https://evil.example/x.css";`.
const CSS_IMPORT_RE = /@import\b[^;]*;?/gi;
// A generic origin-token scan rather than a `url(...)`-specific regex: `url()` is not the
// only CSS function that can carry an absolute URL (`image-set()`, `-webkit-image-set()`,
// `cross-fade()`, and others), so instead of enumerating function names this matches any
// quoted-or-bare `http://`/`https://`/`//`-prefixed token wherever it appears in the CSS
// text, covering every current and future URL-bearing function in a single pass.
const CSS_ORIGIN_TOKEN_RE = /(['"]?)(https?:\/\/[^\s'")]+|\/\/[^\s'")]+)\1/gi;

function sanitizeCssUrls(css: string): string {
  const withoutComments = css.replace(CSS_COMMENT_RE, '');
  const withoutImports = withoutComments.replace(CSS_IMPORT_RE, '');
  return withoutImports.replace(CSS_ORIGIN_TOKEN_RE, (match: string, _quote: string, rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (trimmed.startsWith('data:') || isAllowedFontOrigin(trimmed)) {
      return match;
    }
    return '';
  });
}

// There is no <body>/<html> element inside a Shadow DOM tree, so any CSS rule selecting
// `body` or `html` as a type selector never matches anything once the article is rendered
// — silently dropping the article's base typography (font-family, font-size, color) when
// those are set on `body{...}` in the source document. Rewrite `body`/`html` to `:host`,
// but only when it is a complete, standalone simple selector: it must start right after
// `{`, `}`, `,`, or the very start of the CSS text (with only whitespace in between), and
// be immediately followed by whitespace-then-`{`, a `,` (selector list continuation), or a
// pseudo-class colon (e.g. `body:hover`). This deliberately excludes compound selectors
// (`body.dark`, `.article-body`, `body#x`) and descendant selectors (`.wrap body`) — those
// are dead-but-harmless CSS, out of scope for this fix, and a false-positive rewrite of the
// substring "body" inside a class name would be worse than leaving them alone.
const BODY_HTML_SELECTOR_RE = /(^|[{},])(\s*)(?:body|html)(?=\s*[{,:])/gi;

function sanitizeBodyHtmlSelectors(css: string): string {
  return css.replace(BODY_HTML_SELECTOR_RE, (_match, boundary: string, whitespace: string) => `${boundary}${whitespace}:host`);
}

const purifier = createDOMPurify(window);
purifier.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'LINK' && !isAllowedFontOrigin(node.getAttribute('href'))) {
    node.remove();
  }
});

/**
 * Rend un article "HTML designé" (document HTML autonome collé tel quel,
 * avec son propre <style> et ses polices Google Fonts) en isolant son CSS
 * du reste du site via un Shadow DOM natif.
 */
@Component({
  selector: 'app-rich-html-article',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #host class="rich-html-article-host"></div>`,
})
export class RichHtmlArticleComponent implements AfterViewInit, OnChanges {
  @Input() content = '';

  @ViewChild('host', { static: true }) private readonly hostRef!: ElementRef<HTMLDivElement>;

  private shadowRoot: ShadowRoot | null = null;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['content'] && this.viewReady) {
      this.render();
    }
  }

  private render(): void {
    if (!this.shadowRoot) {
      this.shadowRoot = this.hostRef.nativeElement.attachShadow({ mode: 'open' });
    }
    this.shadowRoot.innerHTML = this.buildSanitizedMarkup(this.content);
  }

  private buildSanitizedMarkup(rawDocument: string): string {
    const parsed = new DOMParser().parseFromString(rawDocument, 'text/html');

    const linkElements = Array.from(parsed.querySelectorAll('link'));
    const links = linkElements
      .filter((link) => isAllowedFontOrigin(link.getAttribute('href')))
      .map((link) => link.outerHTML)
      .join('\n');

    const styleElements = Array.from(parsed.querySelectorAll('style'));
    const style = styleElements
      .map((el) => this.sanitizeStyleContent(el.textContent ?? ''))
      .join('\n');

    // Remove the harvested <link>/<style> elements from the parsed tree so no
    // unrewritten/unfiltered duplicate survives inside parsed.body.innerHTML below.
    [...linkElements, ...styleElements].forEach((el) => el.remove());

    Array.from(parsed.body?.querySelectorAll('[style]') ?? []).forEach((el) => {
      el.setAttribute('style', sanitizeCssUrls(el.getAttribute('style') ?? ''));
    });

    const body = parsed.body?.innerHTML ?? '';

    const combined = `${links}\n<style>${style}</style>\n${body}`;

    return purifier.sanitize(combined, RICH_HTML_SANITIZE_CONFIG);
  }

  private sanitizeStyleContent(css: string): string {
    return sanitizeBodyHtmlSelectors(sanitizeCssUrls(css).replace(/:root\b/g, ':host'));
  }
}
