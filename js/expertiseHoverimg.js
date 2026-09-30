export function expertiseHover() {
    const elemC = document.querySelector(".expertise_wrapper");
    const fixed = document.querySelector("#fixed-img");

    if (!elemC || !fixed) {
        return;
    }

    const elems = document.querySelectorAll(".elem");
    if (elems.length === 0) {
        return;
    }

    const images = [];
    elems.forEach((e) => {
        const image = e.getAttribute("data-image");
        const img = new Image();
        img.src = image;
        images.push(img);
    });

    elemC.addEventListener("mouseenter", () => {
        fixed.classList.add('visible');
    });

    elemC.addEventListener("mouseleave", () => {
        fixed.classList.remove('visible');
    });

    elems.forEach((e) => {
        e.addEventListener("mouseenter", () => {
            const image = e.getAttribute("data-image");
            fixed.style.backgroundImage = `url(${image})`;
        });
    });
}
