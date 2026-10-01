// The hover preview can be an image or a video (any media slot can hold either)
const isVideo = (url) => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url || "");

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
        if (isVideo(image)) return;
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
            if (isVideo(image)) {
                fixed.style.backgroundImage = "none";
                const video = document.createElement("video");
                Object.assign(video, { src: image, muted: true, loop: true, autoplay: true, playsInline: true });
                fixed.replaceChildren(video);
                video.play?.()?.catch(() => { });
            } else {
                fixed.replaceChildren();
                fixed.style.backgroundImage = `url(${image})`;
            }
        });
    });
}
