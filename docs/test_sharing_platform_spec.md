# TEST SHARING PLATFORM FUNCTIONAL SPECIFICATION

## 1. PURPOSE & TARGET AUDIENCE
The Test Sharing Platform allows administrators/teachers to share study content, build custom assessments, and assign them to students. Students log into their portal to practice, take timed tests, and immediately evaluate their knowledge.

## 2. FUNCTIONAL REQUIREMENTS

### Admin Module
- **Doc Repository**: Store markdown/text documents.
- **Question Generator / Bank**: Add multiple choice questions with custom choices, correct index, and detailed explanation.
- **Test Creator**: Multi-select questions from the bank, specify test title, description, and time limit.
- **Analytics View**: Monitor total tests created, total submissions, pass rate, and student scores.

### Student Module
- **Dashboard**: Card view of all active published tests showing question count, duration, and past score badge.
- **Test Runner Modal**: Fullscreen/focused interface with active countdown timer, current question display, option selector, navigation buttons (Previous, Next), and direct question grid palette.
- **Instant Result Modal**: Shows total score percentage, pass/fail state, and a detailed review list of each question showing student answer vs correct answer with explanations.

### Storage Engine
- Persistent local storage (`localStorage`) initialized with sample pre-built tests (Networking, Data Structures, Web Development) for immediate out-of-the-box demo testing.
