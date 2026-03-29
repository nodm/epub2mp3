import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const __dirname = dirname(fileURLToPath(import.meta.url));

function createSampleEpub() {
  const zip = new AdmZip();

  // mimetype must be first entry, uncompressed
  zip.addFile("mimetype", Buffer.from("application/epub+zip"));

  // container.xml
  zip.addFile(
    "META-INF/container.xml",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`),
  );

  // OPF package document
  zip.addFile(
    "OEBPS/content.opf",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Тестовая книга</dc:title>
    <dc:creator>Тарас Шевченко</dc:creator>
    <dc:language>uk</dc:language>
    <dc:identifier id="uid">urn:uuid:12345</dc:identifier>
  </metadata>
  <manifest>
    <item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch3" href="chapter3.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
    <itemref idref="ch3"/>
  </spine>
</package>`),
  );

  // NAV document (EPUB 3 TOC)
  zip.addFile(
    "OEBPS/nav.xhtml",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>TOC</title></head>
<body>
  <nav epub:type="toc">
    <ol>
      <li><a href="chapter1.xhtml">Розділ перший</a></li>
      <li><a href="chapter2.xhtml">Розділ другий</a></li>
      <li><a href="chapter3.xhtml">Розділ третій</a></li>
    </ol>
  </nav>
</body>
</html>`),
  );

  // Chapter 1 - Ukrainian
  zip.addFile(
    "OEBPS/chapter1.xhtml",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Розділ перший</title></head>
<body>
  <h1>Розділ перший</h1>
  <p>Реве та стогне Дніпр широкий, сердитий вітер завива.</p>
  <p>Додолу верби гне високі, горами хвилю підійма.</p>
</body>
</html>`),
  );

  // Chapter 2 - Ukrainian
  zip.addFile(
    "OEBPS/chapter2.xhtml",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Розділ другий</title></head>
<body>
  <h1>Розділ другий</h1>
  <p>І блідий місяць на ту пору із хмари де-де виглядав.</p>
  <p>Неначе човен в синім морі, то виринав, то потопав.</p>
</body>
</html>`),
  );

  // Chapter 3 - Ukrainian
  zip.addFile(
    "OEBPS/chapter3.xhtml",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Розділ третій</title></head>
<body>
  <h1>Розділ третій</h1>
  <p>Ще треті півні не співали, ніхто ніде не гомонів.</p>
  <p>Сичі в гаю перекликались, та ясен раз у раз скрипів.</p>
</body>
</html>`),
  );

  const outPath = join(__dirname, "fixtures", "sample.epub");
  writeFileSync(outPath, zip.toBuffer());
  console.log(`Created ${outPath}`);
}

createSampleEpub();
