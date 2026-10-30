// Mobile menu toggle and the testimonial slider on the About page.
document.querySelectorAll("[data-menu-button]").forEach((button) => {
  const header = button.closest("[data-header]");
  button.addEventListener("click", () => {
    const open = header.classList.toggle("open");
    button.setAttribute("aria-expanded", open);
  });
});

document.querySelectorAll("[data-slider]").forEach((slider) => {
  const track = slider.querySelector(".slides");
  const dots = [...slider.querySelectorAll(".dots button")];
  let index = 0;
  let timer;
  const show = (i) => {
    index = (i + dots.length) % dots.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d, n) => d.classList.toggle("active", n === index));
  };
  const start = () => {
    clearInterval(timer);
    timer = setInterval(() => show(index + 1), 6000);
  };
  dots.forEach((d, n) => d.addEventListener("click", () => (show(n), start())));
  slider.addEventListener("mouseenter", () => clearInterval(timer));
  slider.addEventListener("mouseleave", start);
  let x0 = null;
  track.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  track.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1)), start();
    x0 = null;
  });
  show(0);
  start();
});
