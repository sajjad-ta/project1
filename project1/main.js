const app = {
    state: {
        courses: [],
        lastPlanDate: null
    },

    init() {
        this.store.load();
        this.router.init();
        this.ui.setupListeners();
    },

    store: {
        load() {
            const data = localStorage.getItem('masterplan_data');
            if (data) {
                app.state = JSON.parse(data);
                // Schema migration: Ensure all topics have a difficulty
                app.state.courses.forEach(course => {
                    if (course.topics) {
                        course.topics.forEach(topic => {
                            if (!topic.difficulty) topic.difficulty = 'medium';
                        });
                    }
                });
            }
        },
        save() {
            localStorage.setItem('masterplan_data', JSON.stringify(app.state));
        }
    },

    router: {
        navigate(viewName, params = {}) {
            const main = document.getElementById('main-content');
            const template = document.getElementById(`view-${viewName}`);

            if (!template) {
                console.error('View not found:', viewName);
                if (viewName === 'dashboard') location.reload();
                return;
            }

            // Update Nav
            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
            const activeBtn = document.getElementById(`btn-${viewName}`);
            if (activeBtn) activeBtn.classList.add('active');

            // Render View
            main.innerHTML = '';
            main.appendChild(template.content.cloneNode(true));

            // Trigger specific view setups
            if (viewName === 'dashboard') app.ui.renderDashboard();
            if (viewName === 'courses') app.ui.renderCourses();
            if (viewName === 'course-details' && params.id) app.ui.renderTopicEditor(params.id);
        },
        init() {
            if (app.state.courses.length === 0) {
                this.navigate('empty');
            } else {
                this.navigate('dashboard');
            }
        }
    },

    planner: {
        getTodaysPlan() {
            if (app.state.courses.length === 0) return [];

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let todaysTasks = [];

            // Point definitions
            const POINTS = { easy: 1, medium: 2, hard: 3 };

            app.state.courses.forEach(course => {
                const examDate = new Date(course.examDate);
                examDate.setHours(0, 0, 0, 0);

                const timeDiff = examDate - today;
                const daysUntil = Math.ceil(timeDiff / (1000 * 3600 * 24));

                const topics = course.topics || [];
                const undoneTopics = topics.filter(t => !t.done);

                // Calculate Total Points Remaining
                const totalPoints = undoneTopics.reduce((sum, t) => sum + (POINTS[t.difficulty] || 2), 0);

                if (daysUntil <= 0 && undoneTopics.length > 0) {
                    // Overdue: Do everything!
                    undoneTopics.forEach(topic => {
                        todaysTasks.push({
                            courseId: course.id,
                            courseName: course.name,
                            topicName: topic.name,
                            topicIndex: topics.indexOf(topic),
                            difficulty: topic.difficulty || 'medium',
                            isLate: true,
                            daysUntil: daysUntil // Pass daysUntil
                        });
                    });
                } else if (daysUntil > 0 && totalPoints > 0) {
                    // Calculate Daily Capacity (Points per day)
                    // If we have 10 points and 2 days, we need 5 points today.
                    // If we have 10 points and 20 days, we need ceil(0.5) = 1 point today.
                    const dailyCapacity = Math.ceil(totalPoints / daysUntil);

                    let currentPoints = 0;

                    // Greedy selection: Take topics until we fill the capacity
                    for (const topic of undoneTopics) {
                        if (currentPoints >= dailyCapacity) break;

                        const points = POINTS[topic.difficulty] || 2;
                        todaysTasks.push({
                            courseId: course.id,
                            courseName: course.name,
                            topicName: topic.name,
                            topicIndex: topics.indexOf(topic),
                            difficulty: topic.difficulty || 'medium',
                            isLate: false,
                            daysUntil: daysUntil // Pass daysUntil
                        });
                        currentPoints += points;
                    }
                }
            });

            // Sort by Urgency: Late > Low Days > Difficulty
            todaysTasks.sort((a, b) => {
                if (a.isLate && !b.isLate) return -1;
                if (!a.isLate && b.isLate) return 1;
                return a.daysUntil - b.daysUntil;
            });

            return todaysTasks;
        }
    },

    ui: {
        setupListeners() {
            const btnDash = document.getElementById('btn-dashboard');
            const btnCourses = document.getElementById('btn-courses');
            if (btnDash) btnDash.addEventListener('click', () => app.router.navigate('dashboard'));
            if (btnCourses) btnCourses.addEventListener('click', () => app.router.navigate('courses'));
        },

        renderCourses() {
            const list = document.getElementById('course-list');
            const form = document.getElementById('add-course-form');
            if (!list || !form) return;

            // Render List
            list.innerHTML = app.state.courses.map(course => {
                const topics = course.topics || [];
                const done = topics.filter(t => t.done).length;
                return `
                <div class="course-item">
                    <div style="flex:1">
                        <h4>${course.name}</h4>
                        <p class="text-sm">Exam: ${course.examDate} • ${done}/${topics.length} Done</p>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button class="secondary-btn" style="width:auto; margin:0; padding:8px 12px; font-size:0.8rem;" 
                            onclick="app.router.navigate('course-details', {id: '${course.id}'})">Edit Topics</button>
                        <button class="delete-btn" onclick="app.courseManager.remove('${course.id}')">Delete</button>
                    </div>
                </div>
            `}).join('');

            // Handle Add
            form.onsubmit = (e) => {
                e.preventDefault();
                const name = document.getElementById('course-name').value;
                const date = document.getElementById('exam-date').value;
                const topicsRaw = document.getElementById('course-topics').value;

                app.courseManager.add({ name, examDate: date, topicsRaw });
                app.ui.renderCourses();
                form.reset();
            };
        },

        renderTopicEditor(courseId) {
            const course = app.state.courses.find(c => c.id === courseId);
            if (!course) return app.router.navigate('courses');

            document.getElementById('detail-course-name').textContent = course.name;
            document.getElementById('detail-exam-date').textContent = `Exam: ${course.examDate}`;

            const list = document.getElementById('detail-topics-list');

            list.innerHTML = (course.topics || []).map((topic, index) => `
                <div class="topic-item">
                    <span>${topic.name}</span>
                    <select class="difficulty-select" onchange="app.courseManager.updateTopicDifficulty('${courseId}', ${index}, this.value)">
                        <option value="easy" ${topic.difficulty === 'easy' ? 'selected' : ''}>Easy</option>
                        <option value="medium" ${topic.difficulty === 'medium' ? 'selected' : ''}>Medium</option>
                        <option value="hard" ${topic.difficulty === 'hard' ? 'selected' : ''}>Hard</option>
                    </select>
                </div>
            `).join('');
        },

        renderDashboard() {
            const plan = app.planner.getTodaysPlan();
            const container = document.getElementById('daily-timeline');
            const dateEl = document.getElementById('current-date');

            const totalTopics = app.state.courses.reduce((acc, c) => acc + (c.topics ? c.topics.length : 0), 0);
            const doneTopics = app.state.courses.reduce((acc, c) => acc + (c.topics ? c.topics.filter(t => t.done).length : 0), 0);
            const progress = totalTopics > 0 ? Math.round((doneTopics / totalTopics) * 100) : 0;

            if (document.getElementById('stat-hours')) document.getElementById('stat-hours').textContent = totalTopics - doneTopics;
            if (document.getElementById('stat-exams')) document.getElementById('stat-exams').textContent = app.state.courses.length;
            if (document.getElementById('stat-progress')) document.getElementById('stat-progress').textContent = `${progress}%`;

            // Fix labels specifically
            const label1 = document.querySelector('#stat-hours + .stat-label');
            if (label1) label1.textContent = "Topics Left";

            if (dateEl) dateEl.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            if (!container) return;

            if (plan.length === 0) {
                if (totalTopics > 0 && totalTopics === doneTopics) {
                    container.innerHTML = `<div class="empty-state"><h2>🎉 All Caught Up!</h2><p>You've completed all your topics.</p></div>`;
                } else if (app.state.courses.length === 0) {
                    container.innerHTML = `<div class="empty-state"><p>Add courses to start.</p></div>`;
                } else {
                    container.innerHTML = `<p style="text-align:center; padding: 20px;">No topics scheduled for today. Relax!</p>`;
                }
                return;
            }

            container.innerHTML = plan.map((task, index) => `
                <div class="task-item" style="border-left-color: ${task.isLate ? '#ef4444' : 'var(--primary)'}">
                    <div class="task-info">
                        ${index === 0 ? '<div class="start-badge">Start Here 🚀</div>' : ''}
                        <h4>${task.courseName} <span class="badge badge-${task.difficulty}">${task.difficulty}</span></h4>
                        <span>${task.topicName} ${task.isLate ? '(Overdue!)' : ''}</span>
                    </div>
                    <button class="check-btn" onclick="app.courseManager.toggleTopic('${task.courseId}', ${task.topicIndex})">
                        ✓
                    </button>
                </div>
            `).join('');
        }
    },

    courseManager: {
        add({ name, examDate, topicsRaw }) {
            const topicsList = topicsRaw.split('\n').map(t => t.trim()).filter(t => t.length > 0);
            // Default difficulty: Medium
            const topicsObjects = topicsList.map(t => ({ name: t, done: false, difficulty: 'medium' }));

            app.state.courses.push({
                id: Date.now().toString(),
                name,
                examDate,
                topics: topicsObjects
            });
            app.store.save();
        },
        remove(id) {
            app.state.courses = app.state.courses.filter(c => c.id !== id);
            app.store.save();
            app.ui.renderCourses();
        },
        updateTopicDifficulty(courseId, topicIndex, newDifficulty) {
            const course = app.state.courses.find(c => c.id === courseId);
            if (course && course.topics[topicIndex]) {
                course.topics[topicIndex].difficulty = newDifficulty;
                app.store.save();
                // Re-render editor to confirm (optional, usually native select updates itself visually)
                // However, we might want to trigger a visual feedback? No need for MVP.
            }
        },
        toggleTopic(courseId, topicIndex) {
            const course = app.state.courses.find(c => c.id === courseId);
            if (course && course.topics[topicIndex]) {
                course.topics[topicIndex].done = true;
                app.store.save();
                app.ui.renderDashboard();
            }
        }
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => app.init());
