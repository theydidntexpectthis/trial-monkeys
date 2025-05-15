// DOM Elements
const taskInput = document.getElementById('taskInput');
const addTaskButton = document.getElementById('addTask');
const taskList = document.getElementById('taskList');
const taskCount = document.getElementById('taskCount');
const clearCompletedButton = document.getElementById('clearCompleted');
const allTasksButton = document.getElementById('allTasks');
const activeTasksButton = document.getElementById('activeTasks');
const completedTasksButton = document.getElementById('completedTasks');

// Task array to store todos
let tasks = [];
let currentFilter = 'all';

// Load tasks from localStorage
function loadTasks() {
    const storedTasks = localStorage.getItem('tasks');
    if (storedTasks) {
        tasks = JSON.parse(storedTasks);
        renderTasks();
    }
}

// Save tasks to localStorage
function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Create a new task object
function createTask(text) {
    return {
        id: Date.now(),
        text: text,
        completed: false
    };
}

// Add a new task
function addTask() {
    const text = taskInput.value.trim();
    if (text !== '') {
        const task = createTask(text);
        tasks.push(task);
        taskInput.value = '';
        saveTasks();
        renderTasks();
    }
}

// Delete a task
function deleteTask(id) {
    tasks = tasks.filter(task => task.id !== id);
    saveTasks();
    renderTasks();
}

// Toggle task completion status
function toggleTaskStatus(id) {
    tasks = tasks.map(task => {
        if (task.id === id) {
            return { ...task, completed: !task.completed };
        }
        return task;
    });
    saveTasks();
    renderTasks();
}

// Clear all completed tasks
function clearCompleted() {
    tasks = tasks.filter(task => !task.completed);
    saveTasks();
    renderTasks();
}

// Filter tasks based on current filter
function getFilteredTasks() {
    switch (currentFilter) {
        case 'active':
            return tasks.filter(task => !task.completed);
        case 'completed':
            return tasks.filter(task => task.completed);
        default:
            return tasks;
    }
}

// Update task counter
function updateTaskCount() {
    const activeTasks = tasks.filter(task => !task.completed).length;
    taskCount.textContent = `${activeTasks} task${activeTasks !== 1 ? 's' : ''} left`;
}

// Set active filter button
function setActiveFilterButton() {
    [allTasksButton, activeTasksButton, completedTasksButton].forEach(button => {
        button.classList.remove('active');
    });

    if (currentFilter === 'all') {
        allTasksButton.classList.add('active');
    } else if (currentFilter === 'active') {
        activeTasksButton.classList.add('active');
    } else if (currentFilter === 'completed') {
        completedTasksButton.classList.add('active');
    }
}

// Render tasks to the DOM
function renderTasks() {
    taskList.innerHTML = '';
    const filteredTasks = getFilteredTasks();
    
    filteredTasks.forEach(task => {
        const taskItem = document.createElement('li');
        taskItem.className = `task-item ${task.completed ? 'completed' : ''}`;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', () => toggleTaskStatus(task.id));
        
        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.textContent = task.text;
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-btn';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => deleteTask(task.id));
        
        taskItem.appendChild(checkbox);
        taskItem.appendChild(taskText);
        taskItem.appendChild(deleteButton);
        
        taskList.appendChild(taskItem);
    });
    
    updateTaskCount();
    setActiveFilterButton();
}

// Event Listeners
addTaskButton.addEventListener('click', addTask);

taskInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') {
        addTask();
    }
});

clearCompletedButton.addEventListener('click', clearCompleted);

allTasksButton.addEventListener('click', () => {
    currentFilter = 'all';
    renderTasks();
});

activeTasksButton.addEventListener('click', () => {
    currentFilter = 'active';
    renderTasks();
});

completedTasksButton.addEventListener('click', () => {
    currentFilter = 'completed';
    renderTasks();
});

// Initialize app
document.addEventListener('DOMContentLoaded', loadTasks);
