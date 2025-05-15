document.addEventListener('DOMContentLoaded', () => {
    // Search functionality
    const searchInput = document.querySelector('.search-bar input');
    const botCards = document.querySelectorAll('.bot-card');
    
    searchInput?.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        botCards.forEach(card => {
            const botName = card.querySelector('h3').textContent.toLowerCase();
            card.style.display = botName.includes(searchTerm) ? 'block' : 'none';
        });
    });

    // Category filter buttons
    const categoryButtons = document.querySelectorAll('.categories button');
    categoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            categoryButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            // Add category filtering logic here
        });
    });

    // Install button click handlers
    const installButtons = document.querySelectorAll('.bot-card button');
    installButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const botName = button.parentElement.querySelector('h3').textContent;
            button.textContent = 'Installing...';
            try {
                // Simulate installation
                await new Promise(resolve => setTimeout(resolve, 1000));
                button.textContent = 'Installed';
                button.disabled = true;
            } catch (error) {
                button.textContent = 'Install';
                console.error(`Failed to install ${botName}:`, error);
            }
        });
    });
});
