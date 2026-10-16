(() => {
    "use strict";
    const key = "pocket-signal-welcome-v1";
    const showWelcome = () => {
        try { if (sessionStorage.getItem(key) === "seen") return; } catch (_) {}
        if (document.getElementById("psWelcome") || typeof HTMLDialogElement === "undefined" || typeof HTMLDialogElement.prototype.showModal !== "function") return;
        const dialog = document.createElement("dialog");
        dialog.id = "psWelcome";
        dialog.className = "ps-welcome";
        dialog.setAttribute("aria-labelledby", "psWelcomeTitle");
        dialog.setAttribute("aria-describedby", "psWelcomeDescription");
        dialog.innerHTML = `
            <button type="button" class="ps-welcome-close" aria-label="Close welcome">×</button>
            <div class="ps-welcome-mark" aria-hidden="true"><svg class="ps-welcome-bolt" viewBox="0 0 32 44"><path d="M19 2 4 25h11l-2 17 15-25H17Z"/></svg></div>
            <p class="ps-welcome-kicker">Read the coverage. Make the play.</p>
            <h2 id="psWelcomeTitle">Welcome to Pocket Signal.</h2>
            <p class="ps-welcome-greeting">We’re glad you’re here.</p>
            <p id="psWelcomeDescription" class="ps-welcome-copy">Explore NFL game forecasts, player projections, and the numbers behind each matchup—all in one place.</p>
            <div class="ps-welcome-tags" aria-hidden="true"><span>Game forecasts</span><span>Player outlooks</span><span>Market comparisons</span></div>
            <button type="button" class="ps-welcome-enter">Explore Pocket Signal</button>
            <p class="ps-welcome-tagline">A clearer view of the game.</p>`;
        const previous = document.activeElement;
        const dismiss = () => dialog.close();
        dialog.querySelectorAll("button").forEach(button => button.addEventListener("click", dismiss));
        dialog.addEventListener("keydown", event => {
            if (event.key !== "Tab") return;
            const buttons = [...dialog.querySelectorAll("button")];
            const first = buttons[0], last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        });
        dialog.addEventListener("click", event => {
            if (event.target !== dialog) return;
            const bounds = dialog.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dismiss();
        });
        dialog.addEventListener("close", () => {
            document.body.classList.remove("ps-welcome-open");
            dialog.remove();
            if (previous instanceof HTMLElement && previous !== document.body && previous.isConnected) previous.focus({preventScroll:true});
            else document.querySelector("#homeButton, .brand-button, a[href='index.html']")?.focus({preventScroll:true});
        }, {once:true});
        document.body.append(dialog);
        try { dialog.showModal(); } catch (_) { dialog.remove(); return; }
        try { sessionStorage.setItem(key,"seen"); } catch (_) {}
        document.body.classList.add("ps-welcome-open");
        dialog.querySelector(".ps-welcome-enter").focus({preventScroll:true});
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",showWelcome,{once:true});
    else showWelcome();
})();
