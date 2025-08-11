/* 
In the case that somebody wants to adapt this application to another pdf format, you could test the best formatting option with a local LLM. I recommend LM Studio.
The following is my prompt before the pdfConverted.js util was developped.
*/

export const sendToLLM = async (text) => {
  const response = await fetch("/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "your-local-model-name",
      messages: [
        {
          role: "system",
          content: `
From the following schedule text, extract entries in this exact format (one entry per line):
<name> | <days> <time-range> | <startDate>-<endDate>

Where:
- <name> is a course code (Example: TC2007B).
- <days> uses short Spanish day abbreviations (Lun, Mar, Mié, Jue, Vie, Sáb, Dom) possibly separated by commas.
- <time-range> is "HH:MM - HH:MM" (24h).
- <startDate> and <endDate> are in dd.mm.yyyy format.

Only output lines for courses from sections 'Bloques / Materias del plan de estudios' or those starting with 'ST'. 
If one course has more than one <days> <time-range> section, include them as separate courses with the same name.
Do not include additional text, explanation, headings, or JSON—only the lines in the exact pipe-separated format above.
          `,
        },
        { role: "user", content: text },
      ],
      temperature: 0,
      max_tokens: -1,
      stream: false,
    }),
  });
  const data = await response.json();
  return data.choices[0].message.content;
};
