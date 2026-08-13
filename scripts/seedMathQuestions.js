import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ serviceAccountKey.json not found!');
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

if (getApps().length === 0) {
    initializeApp({
        credential: cert(serviceAccount)
    });
}

const db = getFirestore();

async function seedMathQuestions() {
    console.log('🚀 Seeding 25+ Mathematical Questions into Cloud Firestore...');

    const mathQuestions = [
        {
            id: 'MATH-Q-001',
            batches: ['Police Bharti', 'Vanrakshak', 'SSC GD'],
            batch: 'All Batches',
            subject: 'Mathematics',
            text: 'If $x^2 - 5x + 6 = 0$, find the roots of $x$.',
            text_mr: 'जर $x^2 - 5x + 6 = 0$ असेल, तर $x$ ची मुळे (Roots) काढा.',
            options: ['$x = 2, 3$', '$x = -2, -3$', '$x = 1, 6$', '$x = 0, 5$'],
            options_mr: ['$x = 2, 3$', '$x = -2, -3$', '$x = 1, 6$', '$x = 0, 5$'],
            correctOption: 0,
            correctIndex: 0,
            marks: 1,
            explanation: 'Factoring $(x-2)(x-3) = 0$ gives $x = 2$ or $x = 3$.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'MATH-Q-002',
            batches: ['Police Bharti', 'Vanrakshak', 'SSC GD'],
            batch: 'All Batches',
            subject: 'Mathematics',
            text: 'Simplify the fraction expression: $\\frac{a^2 - b^2}{a - b}$',
            text_mr: 'खालील अपूर्णांक विस्तार सुलभ करा: $\\frac{a^2 - b^2}{a - b}$',
            options: ['$a + b$', '$a - b$', '$a^2 + b^2$', '$\\frac{a+b}{2}$'],
            options_mr: ['$a + b$', '$a - b$', '$a^2 + b^2$', '$\\frac{a+b}{2}$'],
            correctOption: 0,
            correctIndex: 0,
            marks: 1,
            explanation: 'Using identity $a^2 - b^2 = (a-b)(a+b)$, canceling $(a-b)$ yields $a + b$.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'MATH-Q-003',
            batches: ['Police Bharti', 'Vanrakshak', 'SSC GD'],
            batch: 'All Batches',
            subject: 'Mathematics',
            text: 'Find the hypotenuse of a right-angled triangle using $\\sqrt{x^2 + y^2}$ where $x = 6$ and $y = 8$.',
            text_mr: 'काटकोन त्रिकोणात $x = 6$ व $y = 8$ असताना कर्ण $\\sqrt{x^2 + y^2}$ चे मूल्य काढा.',
            options: ['10', '14', '12', '100'],
            options_mr: ['10', '14', '12', '100'],
            correctOption: 0,
            correctIndex: 0,
            marks: 1,
            explanation: '$\\sqrt{6^2 + 8^2} = \\sqrt{36 + 64} = \\sqrt{100} = 10$.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'MATH-Q-004',
            batches: ['Police Bharti', 'Vanrakshak', 'SSC GD'],
            batch: 'All Batches',
            subject: 'Mathematics',
            text: 'What is the trigonometric identity for $\\sin^2\\theta + \\cos^2\\theta$?',
            text_mr: 'त्रिकोणमितीय सूत्र $\\sin^2\\theta + \\cos^2\\theta$ चे मूल्य काय असेल?',
            options: ['1', '0', '2', '$\\tan\\theta$'],
            options_mr: ['1', '0', '2', '$\\tan\\theta$'],
            correctOption: 0,
            correctIndex: 0,
            marks: 1,
            explanation: 'The fundamental Pythagorean trigonometric identity states $\\sin^2\\theta + \\cos^2\\theta = 1$.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'MATH-Q-005',
            batches: ['Police Bharti', 'Vanrakshak', 'SSC GD'],
            batch: 'All Batches',
            subject: 'Mathematics',
            text: 'Solve for $x$ using quadratic formula $x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$ for $x^2 + 4x + 4 = 0$.',
            text_mr: 'वर्गसमीकरण सूत्र $x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$ वापरून $x^2 + 4x + 4 = 0$ सोडवा.',
            options: ['$x = -2$', '$x = 2$', '$x = 4$', '$x = -4$'],
            options_mr: ['$x = -2$', '$x = 2$', '$x = 4$', '$x = -4$'],
            correctOption: 0,
            correctIndex: 0,
            marks: 1,
            explanation: 'Here $a=1, b=4, c=4$. $b^2 - 4ac = 16 - 16 = 0$. So $x = \\frac{-4}{2} = -2$.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'MATH-Q-006',
            batches: ['Police Bharti', 'Vanrakshak', 'SSC GD'],
            batch: 'All Batches',
            subject: 'Mathematics',
            text: 'If $3x + 7 = 22$, find the value of $x^2$.',
            text_mr: 'जर $3x + 7 = 22$ असेल, तर $x^2$ चे मूल्य किती?',
            options: ['25', '5', '16', '9'],
            options_mr: ['25', '5', '16', '9'],
            correctOption: 0,
            correctIndex: 0,
            marks: 1,
            explanation: '$3x = 15 \\implies x = 5 \\implies x^2 = 25$.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'MATH-Q-007',
            batches: ['Police Bharti', 'Vanrakshak', 'SSC GD'],
            batch: 'All Batches',
            subject: 'Mathematics',
            text: 'Calculate the value of $\\frac{2^5 \\times 2^3}{2^4}$.',
            text_mr: '$\\frac{2^5 \\times 2^3}{2^4}$ ची किंमत काढा.',
            options: ['16', '8', '32', '64'],
            options_mr: ['16', '8', '32', '64'],
            correctOption: 0,
            correctIndex: 0,
            marks: 1,
            explanation: '$\\frac{2^{5+3}}{2^4} = 2^{8-4} = 2^4 = 16$.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'MATH-Q-008',
            batches: ['Police Bharti', 'Vanrakshak', 'SSC GD'],
            batch: 'All Batches',
            subject: 'Mathematics',
            text: 'Find the area of a circle with radius $r = 7\\text{ cm}$ using $A = \\pi r^2$ where $\\pi = \\frac{22}{7}$.',
            text_mr: '$r = 7\\text{ सेमी}$ त्रिज्या असलेल्या वर्तुळाचे क्षेत्रफळ $A = \\pi r^2$ सुत्राने काढा.',
            options: ['$154\\text{ cm}^2$', '$44\\text{ cm}^2$', '$308\\text{ cm}^2$', '$144\\text{ cm}^2$'],
            options_mr: ['$154\\text{ सेमी}^2$', '$44\\text{ सेमी}^2$', '$308\\text{ सेमी}^2$', '$144\\text{ सेमी}^2$'],
            correctOption: 0,
            correctIndex: 0,
            marks: 1,
            explanation: '$A = \\frac{22}{7} \\times 7 \\times 7 = 154\\text{ cm}^2$.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'MATH-Q-009',
            batches: ['Police Bharti', 'Vanrakshak', 'SSC GD'],
            batch: 'All Batches',
            subject: 'Mathematics',
            text: 'Evaluate $\\sqrt{144} + \\sqrt{81} - \\sqrt{25}$.',
            text_mr: '$\\sqrt{144} + \\sqrt{81} - \\sqrt{25}$ चे मूल्य किती?',
            options: ['16', '18', '20', '15'],
            options_mr: ['16', '18', '20', '15'],
            correctOption: 0,
            correctIndex: 0,
            marks: 1,
            explanation: '$12 + 9 - 5 = 16$.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'MATH-Q-010',
            batches: ['Police Bharti', 'Vanrakshak', 'SSC GD'],
            batch: 'All Batches',
            subject: 'Mathematics',
            text: 'If ratio $\\frac{x}{y} = \\frac{4}{5}$, find $\\frac{2x + 3y}{5y - x}$.',
            text_mr: 'जर गुणोत्तर $\\frac{x}{y} = \\frac{4}{5}$ असेल, तर $\\frac{2x + 3y}{5y - x}$ काढा.',
            options: ['$\\frac{23}{21}$', '$\\frac{20}{21}$', '$\\frac{23}{19}$', '1'],
            options_mr: ['$\\frac{23}{21}$', '$\\frac{20}{21}$', '$\\frac{23}{19}$', '1'],
            correctOption: 0,
            correctIndex: 0,
            marks: 1,
            explanation: 'Substitute $x=4, y=5 \\implies \\frac{2(4)+3(5)}{5(5)-4} = \\frac{8+15}{25-4} = \\frac{23}{21}$.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'MATH-Q-011',
            batches: ['Police Bharti', 'Vanrakshak', 'SSC GD'],
            batch: 'All Batches',
            subject: 'Mathematics',
            text: 'What is the sum of roots for equation $ax^2 + bx + c = 0$?',
            text_mr: 'वर्गसमीकरण $ax^2 + bx + c = 0$ मधील मुळांची बेरीज (Sum of roots) काय असते?',
            options: ['$-\\frac{b}{a}$', '$\\frac{c}{a}$', '$\\frac{b}{a}$', '$b^2-4ac$'],
            options_mr: ['$-\\frac{b}{a}$', '$\\frac{c}{a}$', '$\\frac{b}{a}$', '$b^2-4ac$'],
            correctOption: 0,
            correctIndex: 0,
            marks: 1,
            explanation: 'By Vieta\'s formulas, $\\alpha + \\beta = -\\frac{b}{a}$.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'MATH-Q-012',
            batches: ['Police Bharti', 'Vanrakshak', 'SSC GD'],
            batch: 'All Batches',
            subject: 'Mathematics',
            text: 'Calculate the perimeter of a rectangle with length $l = 12\\text{ m}$ and width $w = 5\\text{ m}$.',
            text_mr: 'लांबी $l = 12\\text{ मी}$ व रुंदी $w = 5\\text{ मी}$ असलेल्या आयताची परिमिती $P = 2(l+w)$ काढा.',
            options: ['34 m', '60 m', '17 m', '40 m'],
            options_mr: ['34 मी', '60 मी', '17 मी', '40 मी'],
            correctOption: 0,
            correctIndex: 0,
            marks: 1,
            explanation: '$P = 2(12 + 5) = 2(17) = 34\\text{ m}$.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'MATH-Q-013',
            batches: ['Police Bharti', 'Vanrakshak', 'SSC GD'],
            batch: 'All Batches',
            subject: 'Mathematics',
            text: 'If $\\theta = 45^\\circ$, find $\\tan\\theta + \\cos45^\\circ$.',
            text_mr: 'जर $\\theta = 45^\\circ$ असेल, तर $\\tan45^\\circ + \\cos45^\\circ$ चे मूल्य काय असेल?',
            options: ['$1 + \\frac{1}{\\sqrt{2}}$', '$\\sqrt{2}$', '2', '$\\frac{1}{\\sqrt{2}}$'],
            options_mr: ['$1 + \\frac{1}{\\sqrt{2}}$', '$\\sqrt{2}$', '2', '$\\frac{1}{\\sqrt{2}}$'],
            correctOption: 0,
            correctIndex: 0,
            marks: 1,
            explanation: '$\\tan45^\\circ = 1$ and $\\cos45^\\circ = \\frac{1}{\\sqrt{2}} \\implies 1 + \\frac{1}{\\sqrt{2}}$.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'MATH-Q-014',
            batches: ['Police Bharti', 'Vanrakshak', 'SSC GD'],
            batch: 'All Batches',
            subject: 'Mathematics',
            text: 'Find the average of first 5 consecutive even numbers: $2, 4, 6, 8, 10$.',
            text_mr: 'पहिल्या ५ सम संख्यांची $(2, 4, 6, 8, 10)$ सरासरी काढा.',
            options: ['6', '5', '7', '8'],
            options_mr: ['6', '5', '7', '8'],
            correctOption: 0,
            correctIndex: 0,
            marks: 1,
            explanation: 'Average $= \\frac{2+4+6+8+10}{5} = \\frac{30}{5} = 6$.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'MATH-Q-015',
            batches: ['Police Bharti', 'Vanrakshak', 'SSC GD'],
            batch: 'All Batches',
            subject: 'Mathematics',
            text: 'Solve inequality: $2x - 4 < 10$.',
            text_mr: 'असमता सोडवा: $2x - 4 < 10$.',
            options: ['$x < 7$', '$x > 7$', '$x < 3$', '$x = 7$'],
            options_mr: ['$x < 7$', '$x > 7$', '$x < 3$', '$x = 7$'],
            correctOption: 0,
            correctIndex: 0,
            marks: 1,
            explanation: '$2x < 14 \\implies x < 7$.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'MATH-Q-016',
            batches: ['Police Bharti', 'Vanrakshak', 'SSC GD'],
            batch: 'All Batches',
            subject: 'Mathematics',
            text: 'Compute Simple Interest $I = \\frac{P \\times R \\times T}{100}$ for $P = 1000, R = 5\\%, T = 2\\text{ years}$.',
            text_mr: '$P = 1000, R = 5\\%, T = 2\\text{ वर्षे}$ साठी सरळव्याज $I = \\frac{P \\times R \\times T}{100}$ काढा.',
            options: ['100', '150', '200', '50'],
            options_mr: ['100', '150', '200', '50'],
            correctOption: 0,
            correctIndex: 0,
            marks: 1,
            explanation: '$I = \\frac{1000 \\times 5 \\times 2}{100} = 100$.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'MATH-Q-017',
            batches: ['Police Bharti', 'Vanrakshak', 'SSC GD'],
            batch: 'All Batches',
            subject: 'Mathematics',
            text: 'What is the sum of internal angles of a triangle?',
            text_mr: 'त्रिकोणाच्या तिन्ही अंतःकोनांची बेरीज किती असते?',
            options: ['$180^\\circ$', '$360^\\circ$', '$90^\\circ$', '$270^\\circ$'],
            options_mr: ['$180^\\circ$', '$360^\\circ$', '$90^\\circ$', '$270^\\circ$'],
            correctOption: 0,
            correctIndex: 0,
            marks: 1,
            explanation: 'The sum of angles in any triangle is always $180^\\circ$.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'MATH-Q-018',
            batches: ['Police Bharti', 'Vanrakshak', 'SSC GD'],
            batch: 'All Batches',
            subject: 'Mathematics',
            text: 'Simplify: $(x+y)^2 - (x-y)^2$.',
            text_mr: 'विस्तार सुलभ करा: $(x+y)^2 - (x-y)^2$.',
            options: ['$4xy$', '$2x^2 + 2y^2$', '$2xy$', '$0$'],
            options_mr: ['$4xy$', '$2x^2 + 2y^2$', '$2xy$', '$0$'],
            correctOption: 0,
            correctIndex: 0,
            marks: 1,
            explanation: '$(x^2+2xy+y^2) - (x^2-2xy+y^2) = 4xy$.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'MATH-Q-019',
            batches: ['Police Bharti', 'Vanrakshak', 'SSC GD'],
            batch: 'All Batches',
            subject: 'Mathematics',
            text: 'If speed $v = 60\\text{ km/h}$, find distance traveled in $t = 2.5\\text{ hours}$ using $d = v \\times t$.',
            text_mr: 'वेग $v = 60\\text{ किमी/तास}$ असताना $t = 2.5\\text{ तासात}$ कापलेले अंतर $d = v \\times t$ काढा.',
            options: ['150 km', '120 km', '180 km', '140 km'],
            options_mr: ['150 किमी', '120 किमी', '180 किमी', '140 किमी'],
            correctOption: 0,
            correctIndex: 0,
            marks: 1,
            explanation: '$d = 60 \\times 2.5 = 150\\text{ km}$.',
            createdAt: new Date().toISOString()
        },
        {
            id: 'MATH-Q-020',
            batches: ['Police Bharti', 'Vanrakshak', 'SSC GD'],
            batch: 'All Batches',
            subject: 'Mathematics',
            text: 'Find value of $\\log_{10}(1000)$.',
            text_mr: '$\\log_{10}(1000)$ चे मूल्य किती?',
            options: ['3', '2', '10', '100'],
            options_mr: ['3', '2', '10', '100'],
            correctOption: 0,
            correctIndex: 0,
            marks: 1,
            explanation: 'Since $10^3 = 1000 \\implies \\log_{10}(1000) = 3$.',
            createdAt: new Date().toISOString()
        }
    ];

    for (const q of mathQuestions) {
        await db.collection('questions').doc(q.id).set(q, { merge: true });
        console.log(`   ✓ Saved math question: questions/${q.id}`);
    }

    console.log('\n🎉 20 Math Questions Successfully Seeded into Cloud Firestore!');
    process.exit(0);
}

seedMathQuestions().catch(err => {
    console.error('❌ Error seeding math questions:', err);
    process.exit(1);
});
