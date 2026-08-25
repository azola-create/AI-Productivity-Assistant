import { saveAs } from "file-saver";

export type ExportSection = { heading?: string; body?: string; bullets?: string[] };

function safeName(title: string) {
  return (title || "aurawork").replace(/[^\w\d-]+/g, "-").slice(0, 60);
}

export async function exportPdf(title: string, sections: ExportSection[]) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 56;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  const ensure = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(doc.splitTextToSize(title, width), margin, y);
  y += 26;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text("Generated in AURAwork - review AI-generated content before use.", margin, y);
  doc.setTextColor(20);
  y += 24;

  for (const section of sections) {
    if (section.heading) {
      ensure(30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(section.heading, margin, y);
      y += 18;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    if (section.body) {
      for (const line of doc.splitTextToSize(section.body, width) as string[]) {
        ensure(16);
        doc.text(line, margin, y);
        y += 16;
      }
      y += 6;
    }
    for (const bullet of section.bullets ?? []) {
      const lines = doc.splitTextToSize(`•  ${bullet}`, width - 12) as string[];
      for (const line of lines) {
        ensure(16);
        doc.text(line, margin + 8, y);
        y += 16;
      }
    }
    y += 10;
  }

  doc.save(`${safeName(title)}.pdf`);
}

export async function exportDocx(title: string, sections: ExportSection[]) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import("docx");

  const children: InstanceType<typeof Paragraph>[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: title, bold: true })] }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: "Generated in AURAwork — review AI-generated content before use.",
          italics: true,
          size: 18,
          color: "6B7280",
        }),
      ],
    }),
    new Paragraph({ children: [] }),
  ];

  for (const section of sections) {
    if (section.heading) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: section.heading, bold: true })],
        }),
      );
    }
    if (section.body) {
      for (const line of section.body.split("\n")) {
        children.push(new Paragraph({ children: [new TextRun(line)] }));
      }
    }
    for (const bullet of section.bullets ?? []) {
      children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(bullet)] }));
    }
    children.push(new Paragraph({ children: [] }));
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
    sections: [{ children }],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${safeName(title)}.docx`);
}
