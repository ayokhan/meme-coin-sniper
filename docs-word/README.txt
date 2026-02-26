NovaStaris — Word exports of main documentation

Files in this folder (generated from Markdown):
- NovaStaris-Tech-Stack-and-APIs.docx  (TECH_STACK_AND_APIS.md)
- NovaStaris-PRD.docx                 (PRD.md)
- NovaStaris-Go-to-Market.docx       (GO_TO_MARKET.md)
- NovaStaris-Jobs-to-be-Done.docx    (JOBS_TO_BE_DONE.md)
- NovaStaris-Auth-Setup.docx         (AUTH_SETUP.md)

To regenerate after editing the .md files, run in project root:
  npx --yes @mohtasham/md-to-docx TECH_STACK_AND_APIS.md docs-word/NovaStaris-Tech-Stack-and-APIs.docx
  (and similarly for the other files, or use npm run export-docs if added)
