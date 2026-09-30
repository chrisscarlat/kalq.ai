export function mouseMoveParallaxLine() {
    // Define the event listener function so we can remove it later if needed
    function handleMouseMove(e) {
        // Check if the element exists
        const blockElement = document.querySelector('.block');
        if (!blockElement) {
            // If the element does not exist, remove the event listener and exit the function
            document.removeEventListener('mousemove', handleMouseMove);
            console.log('Event listener removed because .block does not exist.');
            return;
        }

        // If the element exists, continue with the original logic
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        const distanceX = (centerX - e.clientX) * 0.05;
        const distanceY = (centerY - e.clientY) * 0.05;

        gsap.to('.block', { duration: 0.5, x: distanceX, y: distanceY, ease: 'Power1.easeOut' });
    }

    // Add the event listener
    document.addEventListener('mousemove', handleMouseMove);

}