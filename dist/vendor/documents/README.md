# Local document readers

These pinned assets are served with the site. File import never depends on a public CDN.

- PDF.js / pdfjs-dist **6.5.438**, Mozilla, Apache-2.0. Legacy browser build plus worker, CMaps, standard fonts and WASM assets. Source: https://github.com/mozilla/pdf.js . Package: https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.5.438.tgz . Licenses are retained in the pdfjs directory.
- fflate **0.8.3**, MIT. Browser ESM build. Source: https://github.com/101arrowz/fflate . Package: https://registry.npmjs.org/fflate/-/fflate-0.8.3.tgz . License: FFLATE-LICENSE.txt.

DOCX and XLSX are read as bounded ZIP/XML documents. Word document text and table cells, visible Excel worksheets, shared/inline strings and cached cell values are supported. Macros, formulas, external links and embedded document scripts are not executed. Old binary DOC/XLS files must be saved as DOCX/XLSX first. CSV, TSV and text are parsed locally with UTF-8, UTF-16 BOM and GB18030 fallback decoding.
