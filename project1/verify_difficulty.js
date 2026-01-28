
// Mock App State
const app = {
    state: {
        courses: [{
            id: 'c1',
            name: 'Test Course',
            examDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], // 2 days from now
            topics: [
                { name: 'Hard Topic', done: false, difficulty: 'hard' },   // 3 pts
                { name: 'Easy Topic 1', done: false, difficulty: 'easy' }, // 1 pt
                { name: 'Easy Topic 2', done: false, difficulty: 'easy' }, // 1 pt
                { name: 'Easy Topic 3', done: false, difficulty: 'easy' }  // 1 pt
            ]
        }]
    }
};

// Paste the Planner Logic to test it
function getPlan(app) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let todaysTasks = [];
    const POINTS = { easy: 1, medium: 2, hard: 3 };

    app.state.courses.forEach(course => {
        const examDate = new Date(course.examDate);
        examDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((examDate - today) / (1000 * 3600 * 24));
        const topics = course.topics || [];
        const undoneTopics = topics.filter(t => !t.done);

        // Logic from main.js
        const totalPoints = undoneTopics.reduce((sum, t) => sum + (POINTS[t.difficulty] || 2), 0);

        console.log(`Debug: Days=${daysUntil}, TotalPoints=${totalPoints}`);

        if (daysUntil > 0 && totalPoints > 0) {
            const dailyCapacity = Math.ceil(totalPoints / daysUntil);
            console.log(`Debug: DailyCapacity=${dailyCapacity}`);

            let currentPoints = 0;
            for (const topic of undoneTopics) {
                if (currentPoints >= dailyCapacity) break;
                const points = POINTS[topic.difficulty] || 2;
                todaysTasks.push({ name: topic.name, difficulty: topic.difficulty, points });
                currentPoints += points;
            }
        }
    });
    return todaysTasks;
}

const plan = getPlan(app);
console.log('--- Today\'s Plan ---');
console.log(JSON.stringify(plan, null, 2));

// Test Expectation:
// Total Points = 3 + 1 + 1 + 1 = 6.
// Days = 2.
// Daily Capacity = 6 / 2 = 3.
// "Hard Topic" is 3 pts. It should take up the whole first day (or satisfy the capacity).
// So Plan should contain ONLY "Hard Topic".
