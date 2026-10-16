const DATA_URL = "data/api/player_projections_2026_week6.json";
const QB_DATA_URL = "data/api/qb_projections_2026_week6.json";
const RB_DATA_URL = "data/api/rb_projections_2026_week6.json";
const SLATE_SEASON = 2026;
const SLATE_WEEK = 6;

function isQuarterback(player) { return player.position === "QB"; }
function isRunningBack(player) { return player.position === "RB"; }
function primaryMetric(player) { return isQuarterback(player) ? "passing_yards" : isRunningBack(player) ? "rushing_yards" : "receiving_yards"; }
function opportunityMetric(player) { return isQuarterback(player) ? "attempts" : "targets"; }
function conversionMetric(player) { return isQuarterback(player) ? "completions" : "receptions"; }

let allPlayers = [];
let filteredPlayers = [];
let selectedPlayer = null;
let selectedMetric = "receiving_yards";
let selectedHistoryWindow = "last5";
let projectionWeek = 6;

const playerList = document.getElementById("playerList");
const playerCount = document.getElementById("playerCount");
const visiblePlayerCount = document.getElementById("visiblePlayerCount");
const playerSearch = document.getElementById("playerSearch");
const positionFilter = document.getElementById("positionFilter");
const sortFilter = document.getElementById("sortFilter");
const gameFilter = document.getElementById("gameFilter");
const gapMetricFilter = document.getElementById("gapMetricFilter");
const marketSortNote = document.getElementById("marketSortNote");
const detailPanel = document.getElementById("playerDetailPanel");
const detailTemplate = document.getElementById("playerDetailTemplate");
const mobileMenuButton = document.getElementById("mobileMenuButton");
const mainNav = document.getElementById("mainNav");

/* =========================================================
   TEAM COLOR SYSTEM
   Used only as a restrained Pocket Signal accent/glow.
========================================================= */

const TEAM_COLORS = {
    ARI: ["#97233F", "#FFB612"],
    ATL: ["#A71930", "#A5ACAF"],
    BAL: ["#241773", "#9E7C0C"],
    BUF: ["#00338D", "#C60C30"],
    CAR: ["#0085CA", "#BFC0BF"],
    CHI: ["#0B162A", "#C83803"],
    CIN: ["#FB4F14", "#000000"],
    CLE: ["#311D00", "#FF3C00"],
    DAL: ["#003594", "#869397"],
    DEN: ["#FB4F14", "#002244"],
    DET: ["#0076B6", "#B0B7BC"],
    GB: ["#203731", "#FFB612"],
    HOU: ["#03202F", "#A71930"],
    IND: ["#002C5F", "#A2AAAD"],
    JAX: ["#006778", "#D7A22A"],
    KC: ["#E31837", "#FFB81C"],
    LV: ["#A5ACAF", "#000000"],
    LAC: ["#0080C6", "#FFC20E"],
    LA: ["#003594", "#FFA300"],
    LAR: ["#003594", "#FFA300"],
    MIA: ["#008E97", "#FC4C02"],
    MIN: ["#4F2683", "#FFC62F"],
    NE: ["#002244", "#C60C30"],
    NO: ["#D3BC8D", "#101820"],
    NYG: ["#0B2265", "#A71930"],
    NYJ: ["#125740", "#FFFFFF"],
    PHI: ["#004C54", "#A5ACAF"],
    PIT: ["#FFB612", "#101820"],
    SF: ["#AA0000", "#B3995D"],
    SEA: ["#002244", "#69BE28"],
    TB: ["#D50A0A", "#FF7900"],
    TEN: ["#0C2340", "#4B92DB"],
    WAS: ["#5A1414", "#FFB612"]
};

function getTeamColors(team) {
    return TEAM_COLORS[String(team || "").trim().toUpperCase()] || ["#27D6FF", "#FFFFFF"];
}

function teamStyle(team) {
    const [primary, secondary] = getTeamColors(team);
    const rgb = primary.match(/\w{2}/g).map(hex => parseInt(hex, 16)).join(", ");
    return `--team-primary:${primary};--team-secondary:${secondary};--team-rgb:${rgb};`;
}

function applyTeamTheme(player) {
    const [primary, secondary] = getTeamColors(player.team);
    detailPanel.style.setProperty("--team-primary", primary);
    detailPanel.style.setProperty("--team-secondary", secondary);
    detailPanel.style.setProperty("--team-rgb", primary.match(/\w{2}/g).map(hex => parseInt(hex, 16)).join(", "));
}

/* =========================================================
   MOBILE NAV
========================================================= */

if (mobileMenuButton && mainNav) {
    mobileMenuButton.addEventListener("click", () => {
        const open = mainNav.classList.toggle("mobile-open");
        mobileMenuButton.setAttribute("aria-expanded", String(open));
    });
}

/* =========================================================
   LOAD DATA
========================================================= */

async function loadPlayers() {
    const sources = [
        {url:DATA_URL, label:"Receiving", qb:false},
        {url:QB_DATA_URL, label:"Quarterback", qb:true},
        {url:RB_DATA_URL, label:"Running back", rb:true}
    ];
    const generationTimes = [];
    const results = await Promise.allSettled(sources.map(async source => {
        const response = await fetch(source.url, {cache:"no-store"});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data.players)) throw new Error("Missing players array");
        const season = firstFinite(data.season, data.metadata?.season);
        const week = firstFinite(data.week, data.projection_week, data.metadata?.week);
        if ((season !== null && season !== SLATE_SEASON) || (week !== null && week !== SLATE_WEEK)
            || ((source.qb || source.rb) && (season === null || week === null))) {
            throw new Error("Projection slate does not match this page");
        }
        const players = data.players.filter(player => player && player.player_id != null);
        if (players.some(player => (source.qb ? !isQuarterback(player) : source.rb ? !isRunningBack(player) : isQuarterback(player))
            || (numberOrNull(player.season) !== null && Number(player.season) !== SLATE_SEASON)
            || (numberOrNull(player.week) !== null && Number(player.week) !== SLATE_WEEK))) {
            throw new Error("Player rows do not match the expected slate or position");
        }
        for (const value of [data.generated_at, data.metadata?.generated_at, ...players.map(player => player.generated_at)]) {
            if (formatRecordedTime(value) && new Date(value).getTime() <= Date.now() + 5 * 60 * 1000) generationTimes.push(value);
        }
        return players;
    }));
    const notices = [];
    const ids = new Set();
    allPlayers = [];
    results.forEach((result, index) => {
        const source = sources[index];
        if (result.status === "rejected") {
            console.warn(`${source.label} projections unavailable:`, result.reason);
            notices.push(`${source.label} projections unavailable for Week ${SLATE_WEEK}.`);
            return;
        }
        for (const player of result.value) {
            const id = String(player.player_id);
            if (!ids.has(id)) { allPlayers.push(player); ids.add(id); }
            else if (source.rb) { allPlayers[allPlayers.findIndex(item => String(item.player_id) === id)] = player; }
        }
        notices.push(`${result.value.length} ${source.qb ? "QB" : source.rb ? "RB" : "receiving"} projections loaded.`);
    });
    const unavailable = notices.filter(message => message.includes("unavailable"));
    const dataStatus = document.getElementById("projectionDataStatus");
    dataStatus.textContent = unavailable.join(" ");
    dataStatus.hidden = unavailable.length === 0;
    const latest = generationTimes.sort((a,b) => new Date(b) - new Date(a))[0];
    const updated = document.getElementById("latestProjectionUpdate");
    updated.textContent = latest ? new Intl.DateTimeFormat("en-US", {
        timeZone:"America/New_York", month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"
    }).format(new Date(latest)) : "Not supplied";
    if (latest) updated.dateTime = latest;
    updated.title = "Newest available projection timestamp. Individual feeds and players may have earlier updates; see each player's details.";
    projectionWeek = SLATE_WEEK;
    document.querySelectorAll(".slate-week").forEach(el => { el.textContent = `Week ${projectionWeek}`; });
    playerCount.textContent = allPlayers.length;
    populateGameFilter();
    applyFilters();
    if (results.every(result => result.status === "rejected")) {
        playerList.innerHTML = '<div class="loading-state">Could not load player projections.</div>';
    }
}

/* =========================================================
   FILTER + SORT
========================================================= */

function playerGameKey(player) {
    const teams = [player.team, player.opponent].map(team => ({LAR:"LA",WSH:"WAS",JAC:"JAX"}[String(team || "").trim().toUpperCase()] || String(team || "").trim().toUpperCase()));
    return teams.every(Boolean) && teams[0] !== teams[1] ? teams.sort().join("|") : null;
}

function populateGameFilter() {
    const previous = gameFilter.value;
    gameFilter.replaceChildren(new Option("All Games", "ALL"));
    const games = [...new Set(allPlayers.map(playerGameKey).filter(Boolean))].sort();
    for (const game of games) gameFilter.add(new Option(game.split("|").join(" vs "), game));
    gameFilter.value = games.includes(previous) ? previous : "ALL";
}

function isGapSort() { return sortFilter.value === "gap_desc" || sortFilter.value === "gap_asc"; }

function gapMetric(player) { return gapMetricFilter.value === "primary" ? primaryMetric(player) : gapMetricFilter.value; }

function playerMarketGap(player) {
    const metric = gapMetric(player);
    const projection = numberOrNull(player.projection?.[metric]?.value);
    const line = numberOrNull(player.market?.[metric]?.line);
    return projection === null || line === null ? null : projection - line;
}

function compareMarketGaps(a, b) {
    const left = playerMarketGap(a), right = playerMarketGap(b);
    if (left === null && right !== null) return 1;
    if (right === null && left !== null) return -1;
    if (left !== null && right !== null) {
        const difference = Math.abs(left) - Math.abs(right);
        if (Math.abs(difference) > 1e-9) return sortFilter.value === "gap_desc" ? -difference : difference;
    }
    return String(a.name || "").localeCompare(String(b.name || "")) || String(a.player_id).localeCompare(String(b.player_id));
}

function listProjectionRead(player) {
    if (!isGapSort()) {
        return `<strong>${format1(player.projection?.[primaryMetric(player)]?.value)}</strong><span>${isQuarterback(player) ? "pass yds" : isRunningBack(player) ? "rush yds" : "rec yds"}</span>`;
    }
    const metric = gapMetric(player), gap = playerMarketGap(player);
    const shortLabels = {passing_yards:"pass yds",rushing_yards:"rush yds",receiving_yards:"rec yds",receptions:"rec",completions:"cmp",attempts:"att"};
    const direction = gap === null || Math.abs(gap) < 1e-9 ? "neutral" : gap < 0 ? "negative" : "positive";
    const explanation = gap === null ? "No matching market line or projection for this metric" : `Projection minus market: ${signed(gap)}; gap size ${format1(Math.abs(gap))}`;
    return `<strong class="list-market-gap gap-${direction}" title="${escapeHtml(explanation)}">${gap === null ? "—" : signed(gap)}</strong><span>gap · ${shortLabels[metric] || ""}</span>`;
}

function applyFilters() {
    const query = playerSearch.value.trim().toLowerCase();
    const position = positionFilter.value;
    let sort = sortFilter.value;
    gapMetricFilter.hidden = !isGapSort();
    marketSortNote.hidden = !isGapSort();
    document.querySelector(".filter-row").classList.toggle("is-gap-sort", isGapSort());
    sortFilter.querySelector('[value="targets"]').textContent = position === "QB" ? "Projected Attempts" : position === "ALL" ? "Targets / Attempts" : "Projected Targets";
    const rbSort = sortFilter.querySelector('[value="rb_receiving_yards"]');
    rbSort.hidden = position !== "RB"; rbSort.disabled = position !== "RB";
    const targetSort = sortFilter.querySelector('[value="targets"]');
    targetSort.hidden = position === "RB"; targetSort.disabled = position === "RB";
    if ((position === "RB" && sort === "targets") || (position !== "RB" && sort === "rb_receiving_yards")) {
        sortFilter.value = "yards"; sort = "yards";
    }
    sortFilter.querySelector('[value="yards"]').textContent = position === "RB" ? "Projected Rushing Yards" : position === "QB" ? "Projected Passing Yards" : "Projected Yards";
    sortFilter.querySelector('[value="receptions"]').textContent = position === "QB" ? "Projected Completions" : position === "ALL" ? "Receptions / Completions" : "Projected Receptions";

    filteredPlayers = allPlayers.filter((player) => {
        const haystack = [
            player.name,
            player.team,
            player.opponent,
            player.position
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        const matchesSearch = haystack.includes(query);
        const matchesPosition =
            position === "ALL" || player.position === position;
        const matchesGame = gameFilter.value === "ALL" || playerGameKey(player) === gameFilter.value;
        return matchesSearch && matchesPosition && matchesGame;
    });

    if (isGapSort()) {
        filteredPlayers.sort(compareMarketGaps);
        const matched = filteredPlayers.filter(player => playerMarketGap(player) !== null).length;
        marketSortNote.textContent = `Ranked by gap size, regardless of sign. ${matched} of ${filteredPlayers.length} have a matching line and projection; others appear last.${gapMetricFilter.value === "primary" ? " Primary yards: QB passing, RB rushing, WR/TE receiving." : ""}`;
    } else if (sort === "yards") {
        filteredPlayers.sort(
            (a, b) =>
                numberValue(b.projection?.[primaryMetric(b)]?.value) -
                numberValue(a.projection?.[primaryMetric(a)]?.value)
        );
    } else if (sort === "rb_receiving_yards") {
        filteredPlayers.sort((a,b) => numberValue(b.projection?.receiving_yards?.value) - numberValue(a.projection?.receiving_yards?.value));
    } else if (sort === "targets") {
        filteredPlayers.sort(
            (a, b) =>
                numberValue(b.projection?.[opportunityMetric(b)]?.value) -
                numberValue(a.projection?.[opportunityMetric(a)]?.value)
        );
    } else if (sort === "receptions") {
        filteredPlayers.sort(
            (a, b) =>
                numberValue(b.projection?.[conversionMetric(b)]?.value) -
                numberValue(a.projection?.[conversionMetric(a)]?.value)
        );
    } else {
        filteredPlayers.sort((a, b) =>
            String(a.name || "").localeCompare(String(b.name || ""))
        );
    }

    renderPlayerList();

    if (
        !selectedPlayer ||
        !filteredPlayers.some(
            (player) =>
                String(player.player_id) ===
                String(selectedPlayer.player_id)
        )
    ) {
        if (filteredPlayers.length > 0) {
            selectPlayer(filteredPlayers[0].player_id);
        } else {
            renderEmptyDetail();
        }
    } else if (isGapSort()) {
        // Keep the detail metric aligned when the ranking metric changes.
        selectPlayer(selectedPlayer.player_id);
    }
}

/* =========================================================
   PLAYER BOARD
========================================================= */

function renderPlayerList() {
    visiblePlayerCount.textContent =
        `${filteredPlayers.length} shown`;

    if (filteredPlayers.length === 0) {
        playerList.innerHTML = `
            <div class="loading-state">
                No players match these filters.
            </div>
        `;
        return;
    }

    playerList.innerHTML = filteredPlayers
        .map((player) => {
            const active =
                selectedPlayer &&
                String(selectedPlayer.player_id) ===
                    String(player.player_id);

            return `
                <button
                    class="player-list-item ${active ? "active" : ""}"
                    data-player-id="${escapeHtml(player.player_id)}"
                    style="${teamStyle(player.team)}"
                    type="button"
                    aria-pressed="${active ? "true" : "false"}"
                >
                    <div class="player-list-main">
                        <span class="player-list-name">
                            ${escapeHtml(player.name)}
                        </span>

                        <span class="player-list-meta">
                            ${escapeHtml(player.position)}
                            <span class="player-list-team-pill">
                                ${escapeHtml(player.team)}
                            </span>
                            vs ${escapeHtml(player.opponent)}
                            · ${escapeHtml(player.role?.tier || "—")}
                        </span>
                    </div>

                    <div class="player-list-projection">
                        ${listProjectionRead(player)}
                    </div>
                </button>
            `;
        })
        .join("");

    document
        .querySelectorAll(".player-list-item")
        .forEach((button) => {
            button.addEventListener("click", () => {
                selectPlayer(button.dataset.playerId);
            });
        });
}

/* =========================================================
   SELECT PLAYER
========================================================= */

function selectPlayer(playerId) {
    const player = allPlayers.find(
        (item) =>
            String(item.player_id) === String(playerId)
    );

    if (!player) {
        return;
    }

    selectedPlayer = player;
    selectedMetric = primaryMetric(player);
    if (isGapSort()) {
        const metrics = isQuarterback(player) ? ["passing_yards","attempts","completions"] : isRunningBack(player) ? ["rushing_yards","receiving_yards","receptions"] : ["receiving_yards","receptions","targets"];
        if (metrics.includes(gapMetric(player))) selectedMetric = gapMetric(player);
    }

    renderPlayerList();
    renderPlayerDetail(player);
}

/* =========================================================
   DETAIL VIEW
========================================================= */

function renderPlayerDetail(player) {
    renderPlayerDetailBase(player);
    finishPlayerPresentation(player);
    detailPanel.querySelectorAll(".metric-tab[data-metric]").forEach(button => {
        const active = button.dataset.metric === selectedMetric;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });
}

function renderPlayerDetailBase(player) {
    const fragment =
        detailTemplate.content.cloneNode(true);

    detailPanel.innerHTML = "";
    detailPanel.appendChild(fragment);

    // Keep the chart before the explanation in both reading and visual order.
    const chartCard = detailPanel.querySelector(".player-chart-card");
    const insightCard = detailPanel.querySelector(".player-insight-card");
    if (chartCard && insightCard) chartCard.after(insightCard);

    applyTeamTheme(player);
    if (isQuarterback(player)) {
        renderQuarterbackDetail(player);
        return;
    }
    if (isRunningBack(player)) {
        renderRunningBackDetail(player);
        return;
    }

    const role = player.role || {};
    const yards = player.projection?.receiving_yards || {};
    const targets = player.projection?.targets || {};
    const receptions = player.projection?.receptions || {};
    const context = player.season_context || {};
    const matchup = player.matchup || {};

    setText(".detail-position", player.position);
    setText(".detail-team", player.team);
    setText(".detail-matchup", player.opponent ? `vs ${player.opponent}` : "Opponent unavailable");
    setText(".detail-name", player.name);
    setText(".detail-role", role.tier || "—");
    setText(
        ".detail-confidence",
        role.confidence
            ? `${role.confidence} workload confidence`
            : "—"
    );
    setText(
        ".detail-trend",
        role.usage_trend
            ? `${role.usage_trend} usage`
            : "—"
    );

    setText(".detail-yards", format1(yards.value));
    setText(
        ".detail-yard-range",
        formatRange(yards, "yds") + " · historical uncertainty"
    );

    renderHeadshot(player);

    /* -------------------------
       MODEL VS BENCHMARK
    ------------------------- */

    setText(
        ".comparison-ps-yards",
        `${format1(yards.value)} yds`
    );

    const market =
        player.market?.receiving_yards || null;

    if (numberOrNull(market?.line) !== null) {
        setText(
            ".comparison-market-yards",
            `${format1(market.line)} yds`
        );

        const gap = numberOrNull(yards.value) !== null
            ? Number(yards.value) - Number(market.line) : null;
        setText(".comparison-gap", gap === null ? "—" : `${signed(gap)} yds`);

        setText(
            ".market-status",
            market.updated_at
                ? `Snapshot ${market.updated_at}`
                : "External reference"
        );
    } else {
        setText(".comparison-market-yards", "—");
        setText(".comparison-gap", "—");
        setText(
            ".market-status",
            "No benchmark loaded"
        );
    }

    /* -------------------------
       PROJECTION BUILD
    ------------------------- */

    setText(
        ".component-targets",
        format1(targets.value)
    );
    setText(
        ".component-target-range",
        formatRange(targets, "targets") + " · historical uncertainty"
    );

    setText(
        ".component-receptions",
        format1(receptions.value)
    );
    setText(
        ".component-reception-range",
        formatRange(receptions, "receptions") + " · historical uncertainty"
    );

    setText(
        ".component-ypr",
        format1(
            player.projection?.yards_per_reception
        )
    );

    setText(
        ".component-yards",
        format1(yards.value)
    );

    /* -------------------------
       CONTEXT
    ------------------------- */

    setText(
        ".context-season-yards",
        format1(context.receiving_yards_avg)
    );
    setText(
        ".context-last3-yards",
        format1(context.last3_receiving_yards_avg)
    );

    const share = context.target_share;

    setText(
        ".context-target-share",
        isFiniteNumber(share)
            ? `${(Number(share) * 100).toFixed(1)}%`
            : "—"
    );

    setText(
        ".context-matchup",
        matchup.label || "—"
    );

    setText(
        ".context-matchup-index",
        isFiniteNumber(matchup.index)
            ? `Index ${format0(matchup.index)}`
            : ""
    );

    /* -------------------------
       WHY POCKET SIGNAL SEES IT THIS WAY
    ------------------------- */

    setMarketBenchmarkColor(player);
    renderReasons(player);

    setText(
        ".detail-summary",
        buildPlayerRead(player)
    );

    /* -------------------------
       METRIC TABS
    ------------------------- */

    detailPanel
        .querySelectorAll(".metric-tab")
        .forEach((button) => {
            button.addEventListener("click", () => {
                selectedMetric =
                    button.dataset.metric;

                detailPanel
                    .querySelectorAll(".metric-tab")
                    .forEach((tab) =>
                        { tab.classList.remove("active"); tab.setAttribute("aria-pressed", "false"); }
                    );

                button.classList.add("active");
                button.setAttribute("aria-pressed", "true");

                renderChart(
                    player,
                    selectedMetric
                );
            });
        });

    renderChart(player, selectedMetric);
}


// User-facing facts stay separate from model assumptions and source completeness.
function freshRecordedTime(value) {
    if (!formatRecordedTime(value)) return false;
    const age = Date.now() - new Date(value).getTime();
    return age >= -5 * 60 * 1000 && age <= 48 * 60 * 60 * 1000;
}

function playerStatusRead(player) {
    const a = player.availability || {};
    const status = String(a.status || "Unknown").trim();
    const practice = String(a.practice_status || "");
    const injury = a.practice_injury || a.report_injury || "";
    const suffix = injury ? ` · ${injury}` : "";
    const verifiedDayStatus = a.game_day_status_verified === true && freshRecordedTime(a.game_day_status_checked_at);
    if (verifiedDayStatus && ["Active", "Inactive"].includes(a.game_day_status)) {
        return {badge:a.game_day_status, detail:`${a.game_day_status} · verified game-day report`, alert:a.game_day_status === "Inactive" ? "Inactive for this game. Any displayed pregame projection assumes participation." : ""};
    }
    if (["Out", "Doubtful", "Questionable", "Injured Reserve"].includes(status)) {
        return {badge:status, detail:`${status}${suffix}${a.report_time_verified === true ? "" : " · source report time not verified"}`, alert:`${status}${suffix}. ${status === "Out" || status === "Injured Reserve" ? "Any displayed pregame projection assumes participation and should not be treated as an active-player forecast." : "Game availability needs monitoring."}`};
    }
    if (status === "No game designation" && a.game_status_report_complete === true && a.report_time_verified === true && freshRecordedTime(a.report_timestamp)) {
        return {badge:"No injury designation", detail:"No injury designation on the verified complete game-status report.", alert:""};
    }
    const missed = /did not participate|^dnp$/i.test(practice);
    const limited = /limited/i.test(practice);
    const full = /full participation/i.test(practice);
    const badge = missed ? "Missed practice" : limited ? "Limited practice" : full ? "Full practice" : "";
    const reason = a.basis === "not_listed_in_available_team_report" ? "Not listed in the available team report; game status is not verified."
        : status === "No game designation" ? "The matched entry has no game designation; completeness of the final game-status report is not verified."
        : "Current game status is not verified from the available data.";
    return {badge, detail:reason, alert:missed ? `Reported missed practice${suffix}. Game status has not been verified.`
        : a.practice_review_required ? "Practice entries need review. Game status has not been verified." : ""};
}

function finishPlayerPresentation(player) {
    const a = player.availability || {}, status = playerStatusRead(player);
    const header = detailPanel.querySelector(".player-detail-header");
    let notice = detailPanel.querySelector(".qb-availability-notice");
    if (!notice) { notice = document.createElement("div"); notice.className = "qb-availability-notice"; header.after(notice); }
    notice.textContent = status.alert; notice.hidden = !status.alert;
    const badge = detailPanel.querySelector(".detail-confidence");
    badge.textContent = status.badge; badge.hidden = !status.badge; badge.title = status.detail;
    if (isQuarterback(player)) {
        setText(".detail-role", a.selection_source === "manual_override" ? "Starter change" : "Expected starter");
        detailPanel.querySelector(".detail-trend").hidden = true;
    } else if (isRunningBack(player)) {
        const rank = numberOrNull(player.role?.depth_rank);
        setText(".detail-role", a.selection_source === "manual_override" ? "Role override" : rank === null ? "Listed RB" : `Depth chart: RB${format0(rank)}`);
        detailPanel.querySelector(".detail-trend").hidden = true;
    } else if (!player.role?.usage_trend) detailPanel.querySelector(".detail-trend").hidden = true;
    const updated = document.createElement("p"); updated.className = "player-update-time";
    updated.textContent = formatRecordedTime(player.generated_at) ? `Projection updated ${formatRecordedTime(player.generated_at)}` : "Projection update time unavailable";
    header.after(updated);
    renderPlayerFreshness(player, notice);
    const details = detailPanel.querySelector(".projection-details");
    // Preserve detailed explanations and source facts in one deliberately closed panel.
    for (const selector of [".confidence-explainer", ".qb-model-note", ".chart-uncertainty-note"]) {
        detailPanel.querySelectorAll(selector).forEach(node => details.append(node));
    }
    detailPanel.querySelector(".benchmark-explainer").hidden = true;
    detailPanel.querySelector(".detail-summary").hidden = true;
    detailPanel.querySelector(".model-read-divider").hidden = true;
    const component = detailPanel.querySelector(".component-section");
    component.querySelector(".panel-kicker").textContent = "WEEKLY PROJECTIONS";
    component.querySelector("h3").textContent = "Projected production";
    component.querySelectorAll(".component-arrow").forEach(node => node.hidden = true);
    component.querySelectorAll(".component-card small").forEach(node => node.hidden = true);
    const controls = document.createElement("div"); controls.className = "chart-window-controls";
    controls.setAttribute("role", "group"); controls.setAttribute("aria-label", "Game history window");
    for (const [value,label] of [["last5","Last 5"],["available","Available history"]]) {
        const button = document.createElement("button"); button.type = "button"; button.className = "metric-tab";
        button.dataset.window = value; button.textContent = label;
        button.addEventListener("click", () => { selectedHistoryWindow = value; renderChart(player, selectedMetric); });
        controls.append(button);
    }
    detailPanel.querySelector(".projection-chart").before(controls);
    renderChart(player, selectedMetric);
}

function marketSourceRead(market) {
    const source = typeof market?.sportsbook === "string" ? market.sportsbook : market?.source === "user_screenshot" ? "Screenshot line"
        : typeof market?.source === "string" && market.source.trim() ? market.source.replaceAll("_", " ") : "Source not supplied";
    const time = formatRecordedTime(market?.updated_at);
    return `${source} · ${time || "Capture time not supplied"}`;
}

function historicalLineRead(games, metric, line) {
    if (line === null) return "No line added";
    const values = games.map(game => numberOrNull(game[metric])).filter(value => value !== null);
    if (!values.length) return "Past results unavailable";
    const above = values.filter(value => value > line).length;
    const equal = values.filter(value => value === line).length;
    return `${above} of ${values.length} above ${format1(line)}${equal ? ` · ${equal} equal` : ""}`;
}

function renderMetricSummary(player, metric, games) {
    const config = getMetricConfig(player, metric), value = config.projectionValue;
    const unit = metric === "receptions" ? "rec" : metric === "attempts" ? "att" : metric === "completions" ? "cmp" : metric === "targets" ? "targets" : "yds";
    setText(".detail-yards", format1(value)); setText(".projection-unit", config.label);
    const range = getValidRange(player.projection?.[metric]);
    setText(".detail-yard-range", range ? `${formatRange(player.projection[metric],unit)} historical range` : "");
    setText(".comparison-ps-yards", value === null ? "—" : `${format1(value)} ${unit}`);
    setText(".comparison-card .comparison-sub", `${config.label} projection`);
    const market = player.market?.[metric], line = numberOrNull(market?.line);
    setText(".comparison-market-yards", line === null ? "—" : `${format1(line)} ${unit}`);
    setText(".market-status", line === null ? "No line added" : marketSourceRead(market));
    const gap = line !== null && value !== null ? value - line : null;
    const element = detailPanel.querySelector(".comparison-gap");
    element.classList.remove("gap-negative","gap-positive","gap-neutral"); element.removeAttribute("title");
    setText(".comparison-gap", gap === null ? "—" : `${signed(gap)} ${unit}`);
    if (gap !== null) {
        const direction = Math.abs(gap) < 1e-9 ? "neutral" : gap < 0 ? "negative" : "positive";
        element.classList.add(`gap-${direction}`);
        element.title = `Our projection minus the market line: ${signed(gap)} ${unit}`;
    }
    const marketElement = detailPanel.querySelector(".comparison-market-yards");
    marketElement.classList.remove("market-above","market-below","market-equal");
    const readouts = detailPanel.querySelectorAll(".chart-readout-label");
    readouts[0].textContent = "VS. RECENT FORM"; readouts[1].textContent = "PAST RESULTS VS. THIS LINE";
    setText(".chart-readout-range", historicalLineRead(games, metric, line));
    detailPanel.querySelector(".chart-readout-range").title = "Historical results in the displayed window compared with the loaded line. This is not a forecast probability.";
    setText(".projection-range-detail", range ? `Historical range: ${formatRange(player.projection[metric],unit)}. This is not a guaranteed outcome.` : `A calibrated ${config.label.toLowerCase()} range is not available yet.`);
    setText(".context-season-yards", format1(config.seasonAverage));
    setText(".context-last3-yards", format1(config.last3Average));
    const cards = detailPanel.querySelectorAll(".context-card");
    cards[0].querySelector("small").textContent = config.label;
    cards[1].querySelector("small").textContent = config.label;
    if (!isQuarterback(player) && !isRunningBack(player)) {
        const index = numberOrNull(player.matchup?.index);
        cards[3].querySelector(".context-label").textContent = "Opponent allowance";
        setText(".context-matchup", index === null ? "—" : `${signed(index - 100)}%`);
        setText(".context-matchup-index", index === null ? "Position data unavailable" : `Receiving yards vs. league ${player.position} average`);
    }
    detailPanel.querySelectorAll("[data-window]").forEach(button => {
        button.classList.toggle("active", button.dataset.window === selectedHistoryWindow);
        button.setAttribute("aria-pressed", String(button.dataset.window === selectedHistoryWindow));
    });
    renderReasons(player);
}

function buildWeeklyOutlook(player, metric) {
    const context = player.season_context || {}, config = getMetricConfig(player, metric);
    const reasons = [], add = (category,icon,title,text) => reasons.push({category,icon,title,text});
    if (isRunningBack(player)) {
        const carries = numberOrNull(context.last3_carries_avg), targets = numberOrNull(context.last3_targets_avg);
        const facts = [];
        if (carries !== null) facts.push(`${format1(carries)} carries`);
        if (targets !== null) facts.push(`${format1(targets)} targets`);
        if (facts.length) add("Workload","V","Recent opportunity", `${facts.join(" and ")} per game across the last 3 recorded appearances.`);
    } else {
        const opportunity = getMetricConfig(player, isQuarterback(player) ? "attempts" : "targets");
        if (opportunity.projectionValue !== null) add("Workload","V", "Expected opportunity", `${format1(opportunity.projectionValue)} projected ${opportunity.unit}${opportunity.last3Average === null ? "." : `, compared with ${format1(opportunity.last3Average)} per game over the last 3 recorded appearances.`}`);
    }
    if (config.projectionValue !== null) {
        add("Recent form","3",`${format1(config.projectionValue)} ${config.unit} projected`, config.last3Average !== null
            ? `${comparisonText(config.projectionValue-config.last3Average,config.unit)} the last-3 average of ${format1(config.last3Average)}.`
            : config.seasonAverage !== null ? `${comparisonText(config.projectionValue-config.seasonAverage,config.unit)} the season average of ${format1(config.seasonAverage)}.` : "Recent comparison data is unavailable.");
    }
    const line = config.marketLine;
    if (line !== null && config.projectionValue !== null) {
        add("Market","M", "Projection vs. market", `${format1(config.projectionValue)} projected vs. a ${format1(line)} line: ${comparisonText(config.projectionValue-line,config.shortUnit)} the line.`);
    } else if (!isQuarterback(player) && !isRunningBack(player) && numberOrNull(player.matchup?.index) !== null) {
        const difference = Number(player.matchup.index)-100;
        add("Matchup","M","Opponent receiving allowance", Math.abs(difference)<0.05 ? `Receiving yards allowed to ${player.position}s are in line with the league position average.` : `The opponent has allowed ${format1(Math.abs(difference))}% ${difference > 0 ? "more" : "fewer"} receiving yards to ${player.position}s than the league position average.`);
    } else {
        const companion = getMetricConfig(player, isRunningBack(player) && metric === "rushing_yards" ? "receiving_yards" : isRunningBack(player) ? "rushing_yards" : isQuarterback(player) ? "completions" : "receptions");
        if (companion.projectionValue !== null) add("Production","P",companion.label,`${format1(companion.projectionValue)} projected ${companion.unit}${isRunningBack(player) && metric === "rushing_yards" && numberOrNull(player.projection?.receptions?.value) !== null ? ` on ${format1(player.projection.receptions.value)} projected receptions` : ""}.`);
    }
    return reasons.length ? reasons.slice(0,3) : [{category:"Context",icon:"i",title:"More data needed",text:"Projection and recent context are unavailable for this player."}];
}

function formatRecordedTime(value) {
    if (typeof value !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value.trim())) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    return new Intl.DateTimeFormat("en-US", {
        timeZone:"America/New_York", month:"short", day:"numeric", year:"numeric",
        hour:"numeric", minute:"2-digit", timeZoneName:"short"
    }).format(date);
}

function quarterbackPracticeRead(player) {
    const availability = player.availability || {};
    const practice = availability.practice_status;
    if (!practice) return "Practice information unavailable";
    return `${practice}${availability.practice_injury ? ` · ${availability.practice_injury}` : ""}`;
}

function renderPlayerFreshness(player, notice, selectionDescription = null) {
    if (detailPanel.querySelector(".projection-details")) return;
    const availability = player.availability || {};
    const details = document.createElement("details");
    details.className = "projection-details";
    const summary = document.createElement("summary"); summary.textContent = "Projection details & sources";
    details.append(summary);
    const freshness = document.createElement("section");
    freshness.className = "qb-data-freshness";
    freshness.setAttribute("aria-label", "Projection and report freshness");
    const status = playerStatusRead(player);
    const facts = [
        ["Projection updated", formatRecordedTime(player.generated_at) || "Update time unavailable"],
        ["Game status", status.detail],
        ["Injury report updated", availability.report_time_verified === true && formatRecordedTime(availability.report_timestamp) || "Source report time not verified"],
        ["Practice entry", quarterbackPracticeRead(player)],
        ["Role selection", selectionDescription || availability.selection_reason || player.role?.tier || "Role information unavailable"]
    ];
    for (const [label, value] of facts) {
        const cell = document.createElement("div");
        const heading = document.createElement("span"); heading.textContent = label;
        const detail = document.createElement("strong"); detail.textContent = value;
        cell.append(heading, detail); freshness.append(cell);
    }
    const note = document.createElement("p");
    const saved = formatRecordedTime(availability.injury_feed_file_saved_at);
    note.textContent = `${saved ? `Injury feed refreshed locally ${saved}. ` : ""}A local refresh does not verify when an individual injury report was published. Missing report data does not establish game availability.`;
    freshness.append(note); details.append(freshness);
    const assumptions = document.createElement("p"); assumptions.className = "projection-assumptions";
    assumptions.textContent = isRunningBack(player)
        ? "RB forecasts assume an appearance and historical usage. They do not automatically redistribute touches after teammate injuries."
        : isQuarterback(player) ? "QB forecasts assume the selected quarterback plays the expected role."
        : "Forecasts reflect the supplied role and historical usage. Workload confidence describes role history, not the chance of exceeding a line.";
    details.append(assumptions);
    const range = document.createElement("p"); range.className = "projection-range-detail"; details.append(range);
    const historyNote = document.createElement("p");
    historyNote.textContent = "Past results vs. the loaded line counts the displayed observed games, excludes missing results, and does not estimate the probability of a future outcome.";
    details.append(historyNote);
    detailPanel.querySelector(".player-detail").append(details);
}

function renderQuarterbackDetail(player) {
    detailPanel.querySelector(".player-detail").classList.add("player-qb-detail");
    const p = player.projection || {};
    const context = player.season_context || {};
    const availability = player.availability || {};
    const status = availability.status || "Unknown";
    setText(".detail-position", "QB");
    setText(".detail-team", player.team);
    setText(".detail-matchup", player.opponent ? `vs ${player.opponent}` : "Opponent unavailable");
    setText(".detail-name", player.name);
    setText(".detail-role", availability.selection_source === "manual_override" ? "Starter override" : "Expected QB");
    setText(".detail-confidence", status === "Unknown" ? "Availability unknown" : status === "No game designation" ? "Game status unreported" : `Report: ${status}`);
    setText(".detail-trend", "Conditional forecast");
    setText(".detail-yards", format1(p.passing_yards?.value));
    setText(".projection-unit", "Passing Yards");
    setText(".detail-yard-range", "Range not yet calibrated");
    renderHeadshot(player);
    const notice = document.createElement("div");
    notice.className = "qb-availability-notice";
    notice.textContent = status === "Unknown"
        ? `Week ${projectionWeek} availability is unknown. This forecast assumes ${player.name || "this quarterback"} plays the expected role; the listed QB is not confirmed.`
        : `Week ${projectionWeek} report: ${status}. This forecast assumes ${player.name || "this quarterback"} plays the expected role.`;
    if (status === "No game designation") notice.textContent = `Week ${projectionWeek}: no game status was supplied in the matched report. This forecast assumes ${player.name || "this quarterback"} plays the expected role; practice participation alone does not confirm availability.`;
    if (availability.practice_review_required) notice.textContent += " Practice participation needs starter review.";
    detailPanel.querySelector(".player-detail-header").after(notice);
    renderPlayerFreshness(player, notice);
    setText(".confidence-explainer-title", "About this QB forecast");
    setText(".confidence-explainer-text", "Expected QB describes the selected starter candidate. Availability and workload are not guaranteed; an unknown report is not an active designation.");
    setText(".comparison-ps-yards", `${format1(p.passing_yards?.value)} yds`);
    setText(".comparison-card .comparison-sub", "Passing yards projection");
    const market = player.market?.passing_yards;
    const line = numberOrNull(market?.line);
    const yards = numberOrNull(p.passing_yards?.value);
    setText(".comparison-market-yards", line === null ? "—" : `${format1(line)} yds`);
    const gap = line !== null && yards !== null ? yards - line : null;
    setText(".comparison-gap", gap === null ? "—" : `${signed(gap)} yds`);
    const gapElement = detailPanel.querySelector(".comparison-gap");
    if (gap !== null) {
        const direction = Math.abs(gap) < 1e-9 ? "neutral" : gap < 0 ? "negative" : "positive";
        gapElement.classList.add(`gap-${direction}`);
        gapElement.title = direction === "neutral" ? "Projection equals market benchmark" : `Projection is ${format1(Math.abs(gap))} yds ${gap < 0 ? "below" : "above"} market`;
    }
    setText(".market-status", line === null ? "No passing benchmark loaded" : `${market.updated_at ? `Snapshot ${market.updated_at}` : "External reference"}${gap === null ? "" : ` · ${gapElement.title}`}`);
    setText(".component-section .section-heading-small h3", "Passing forecast and companion estimates");
    const cards = detailPanel.querySelectorAll(".component-card");
    const values = [
        ["Projected Attempts", p.attempts?.value, "Companion forecast"],
        ["Projected Completions", p.completions?.value, "Companion forecast"],
        ["Projected Yards / Attempt", p.yards_per_attempt, "Component efficiency estimate"],
        ["Passing Yards", p.passing_yards?.value, "Final passing projection"]
    ];
    cards.forEach((card, i) => {
        card.querySelector("span").textContent = values[i][0];
        card.querySelector("strong").textContent = format1(values[i][1]);
        card.querySelector("small").textContent = values[i][2];
    });
    const modelNote = document.createElement("p");
    modelNote.className = "qb-model-note";
    modelNote.textContent = player.model?.direct_weight === 1
        ? "Passing yards use the selected direct model. Attempts, completions, and yards per attempt are companion forecasts; multiplying them does not produce the displayed passing-yard projection."
        : numberOrNull(player.model?.direct_weight) !== null
        ? "Passing yards use the selected direct/component blend. The companion forecasts are rounded and may not multiply to the displayed passing-yard projection."
        : "Model selection details are unavailable. Companion forecasts are shown separately from the final passing-yard estimate.";
    detailPanel.querySelector(".component-section").append(modelNote);
    setText(".context-season-yards", format1(context.passing_yards_avg));
    setText(".context-last3-yards", format1(getMetricConfig(player, "passing_yards").last3Average));
    const contexts = detailPanel.querySelectorAll(".context-card");
    contexts[0].querySelector("small").textContent = "Passing yards";
    contexts[1].querySelector("small").textContent = "Prior passing appearances";
    contexts[2].querySelector(".context-label").textContent = "Season Attempts";
    setText(".context-target-share", format1(context.attempts_avg));
    contexts[2].querySelector("small").textContent = "Attempts per appearance";
    setText(".context-matchup", "Not rated");
    setText(".context-matchup-index", "QB matchup grade unavailable");
    renderReasons(player);
    setText(".detail-summary", buildPlayerRead(player));
    const metrics = [["passing_yards", "Passing Yards"], ["attempts", "Attempts"], ["completions", "Completions"]];
    detailPanel.querySelectorAll(".metric-tab").forEach((button, index) => {
        const [metric, label] = metrics[index];
        button.dataset.metric = metric;
        button.textContent = label;
        button.classList.toggle("active", metric === selectedMetric);
        button.setAttribute("aria-pressed", String(metric === selectedMetric));
        button.addEventListener("click", () => {
            selectedMetric = metric;
            detailPanel.querySelectorAll(".metric-tab").forEach(tab => {
                tab.classList.toggle("active", tab === button);
                tab.setAttribute("aria-pressed", String(tab === button));
            });
            renderChart(player, metric);
        });
    });
    renderChart(player, selectedMetric);
}

function buildQuarterbackReasons(player) {
    const reasons = [];
    const add = (category, icon, title, text) => reasons.push({category, icon, title, text});
    const availability = player.availability || {};
    const status = availability.status === "No game designation" ? "No game status supplied" : availability.status || "Unknown";
    add("Role", "R", "Forecast assumes the expected QB plays", `${availability.selection_reason || "Selected starter candidate; starting role is not confirmed."} Week ${projectionWeek} report: ${status}.`);
    if (availability.practice_status) {
        const pieces = [quarterbackPracticeRead(player) + "."];
        if (availability.report_time_verified !== true) pieces.push("The report update time is unverified.");
        pieces.push("Practice participation does not determine whether the player will start or how much he will play.");
        add("Practice", "P", availability.practice_review_required ? "Practice participation needs review" : "Reported practice participation", pieces.join(" "));
    }
    for (const metric of ["attempts", "completions"]) {
        const config = getMetricConfig(player, metric);
        if (config.projectionValue === null) continue;
        const pieces = [`${format1(config.projectionValue)} projected ${config.unit}.`];
        if (config.seasonAverage !== null) pieces.push(`Season average: ${format1(config.seasonAverage)}; forecast is ${comparisonText(config.projectionValue - config.seasonAverage, config.unit)} that average.`);
        if (config.last3Average !== null) pieces.push(`Last 3 passing appearances: ${format1(config.last3Average)} ${config.unit} per game.`);
        add(metric === "attempts" ? "Volume" : "Completions", metric === "attempts" ? "V" : "C", config.label, pieces.join(" "));
    }
    const yards = getMetricConfig(player, "passing_yards");
    const pieces = [];
    if (yards.seasonAverage !== null) pieces.push(`Season average: ${format1(yards.seasonAverage)} passing yards.`);
    if (yards.last3Average !== null) pieces.push(`Last 3 passing appearances: ${format1(yards.last3Average)} yards per game.`);
    if (yards.projectionValue !== null && yards.seasonAverage !== null) pieces.push(`The ${format1(yards.projectionValue)}-yard projection is ${comparisonText(yards.projectionValue - yards.seasonAverage, "yards")} the season average.`);
    if (pieces.length) add("Recent form", "3", "Passing production in context", pieces.join(" "));
    add("Model read", "PS", "A central estimate with an uncalibrated range", "The passing-yard model and companion forecasts are separate estimates. Their differences from recent averages describe the forecast; they are not measured feature contributions. A calibrated QB uncertainty range is not available yet.");
    return reasons;
}

function rbMethodDescription(player, metric) {
    const method = player.model?.methods?.[metric];
    return method === "baseline_blend" ? "Season/recent-average blend" : ["RF", "HGB"].includes(method) ? "Historical pattern model" : "Method details unavailable";
}

function renderRunningBackDetail(player) {
    detailPanel.querySelector(".player-detail").classList.add("player-rb-detail");
    const availability = player.availability || {};
    const status = availability.status || "Unknown";
    const rank = numberOrNull(player.role?.depth_rank);
    setText(".detail-position", "RB");
    setText(".detail-team", player.team);
    setText(".detail-matchup", player.opponent ? `vs ${player.opponent}` : "Opponent unavailable");
    setText(".detail-name", player.name);
    setText(".detail-role", availability.selection_source === "manual_override" ? "Role override" : "Listed RB");
    setText(".detail-confidence", status === "Unknown" ? "Availability unknown" : status === "No game designation" ? "Game status unreported" : `Report: ${status}`);
    setText(".detail-trend", rank === null ? "Conditional role" : `Depth ${format0(rank)} · conditional`);
    renderHeadshot(player);
    const notice = document.createElement("div"); notice.className = "qb-availability-notice";
    const report = status === "No game designation" ? "No game status supplied" : status === "Unknown" ? "Availability unknown" : `Report: ${status}`;
    notice.textContent = `Week ${projectionWeek}: ${report}. Forecasts assume an RB appearance and a role consistent with historical usage.`;
    if (availability.practice_review_required) notice.textContent += " Practice participation needs availability review.";
    detailPanel.querySelector(".player-detail-header").after(notice);
    renderPlayerFreshness(player, notice, availability.selection_source === "manual_override" ? "Manual role override" : rank === null ? "Listed depth-chart RB" : `Listed RB · depth ${format0(rank)}`);
    setText(".confidence-explainer-title", "About this RB forecast");
    setText(".confidence-explainer-text", "These estimates are conditional on an appearance and historical usage. Availability and workload are unconfirmed; teammate injuries do not automatically redistribute touches.");
    setText(".component-section .section-heading-small h3", "Three central forecasts");
    const metrics = ["rushing_yards", "receiving_yards", "receptions"];
    detailPanel.querySelectorAll(".component-arrow").forEach(node => node.remove());
    const cards = [...detailPanel.querySelectorAll(".component-card")];
    cards.forEach((card,index) => {
        if (index >= metrics.length) { card.remove(); return; }
        const metric = metrics[index], config = getMetricConfig(player,metric);
        card.querySelector("span").textContent = config.label;
        card.querySelector("strong").textContent = format1(config.projectionValue);
        card.querySelector("small").textContent = rbMethodDescription(player,metric);
    });
    const note = document.createElement("p"); note.className = "qb-model-note";
    note.textContent = "The three stats are forecast separately. Models and baseline choices were selected using the prior season. Calibrated RB forecast ranges are not available yet.";
    detailPanel.querySelector(".component-section").append(note);
    const context = player.season_context || {};
    const contexts = detailPanel.querySelectorAll(".context-card");
    contexts[2].querySelector(".context-label").textContent = "Recent Carries";
    setText(".context-target-share", format1(context.last3_carries_avg));
    contexts[2].querySelector("small").textContent = "Last 3 recorded appearances";
    contexts[3].querySelector(".context-label").textContent = "Recent Targets";
    setText(".context-matchup", format1(context.last3_targets_avg));
    setText(".context-matchup-index", "Last 3 recorded appearances");
    renderReasons(player);
    setText(".detail-summary", buildPlayerRead(player));
    detailPanel.querySelectorAll(".metric-tab").forEach((button,index) => {
        const metric = metrics[index]; button.dataset.metric = metric;
        button.textContent = getMetricConfig(player,metric).label;
        button.classList.toggle("active", metric === selectedMetric);
        button.setAttribute("aria-pressed",String(metric === selectedMetric));
        button.addEventListener("click", () => {
            selectedMetric = metric;
            detailPanel.querySelectorAll(".metric-tab").forEach(tab => {
                tab.classList.toggle("active",tab === button);
                tab.setAttribute("aria-pressed",String(tab === button));
            });
            renderRunningBackMetric(player,metric);
        });
    });
    renderRunningBackMetric(player,selectedMetric);
}

function renderRunningBackMetric(player,metric) {
    const config = getMetricConfig(player,metric);
    const unit = metric === "receptions" ? "rec" : "yds";
    const value = config.projectionValue;
    setText(".detail-yards",format1(value));
    setText(".projection-unit",config.label);
    setText(".detail-yard-range",getValidRange(player.projection?.[metric]) ? formatRange(player.projection[metric],unit) : "Range not yet calibrated");
    setText(".comparison-ps-yards",value === null ? "—" : `${format1(value)} ${unit}`);
    setText(".comparison-card .comparison-sub",`${config.label} projection`);
    const market = player.market?.[metric];
    const line = numberOrNull(market?.line);
    const gap = line !== null && value !== null ? value-line : null;
    setText(".comparison-market-yards",line === null ? "—" : `${format1(line)} ${unit}`);
    setText(".comparison-gap",gap === null ? "—" : `${signed(gap)} ${unit}`);
    const gapElement = detailPanel.querySelector(".comparison-gap");
    gapElement.classList.remove("gap-negative","gap-positive","gap-neutral");
    gapElement.removeAttribute("title");
    if (gap !== null) {
        const direction = Math.abs(gap) < 1e-9 ? "neutral" : gap < 0 ? "negative" : "positive";
        gapElement.classList.add(`gap-${direction}`);
        gapElement.title = direction === "neutral" ? "Projection equals market benchmark" : `Projection is ${format1(Math.abs(gap))} ${unit} ${gap < 0 ? "below" : "above"} market`;
    }
    const source = market?.source === "user_screenshot" ? "Screenshot benchmark" : market?.updated_at ? `Snapshot ${market.updated_at}` : "External reference";
    setText(".market-status",line === null ? `No ${config.unit} benchmark loaded` : `${source}${gap === null ? "" : ` · ${gapElement.title}`}`);
    setText(".context-season-yards",format1(config.seasonAverage));
    setText(".context-last3-yards",format1(config.last3Average));
    const contexts = detailPanel.querySelectorAll(".context-card");
    contexts[0].querySelector("small").textContent = config.label;
    contexts[1].querySelector("small").textContent = `Prior appearances · ${config.unit}`;
    renderChart(player,metric);
}

function buildRunningBackReasons(player) {
    const reasons = [];
    const add = (category,icon,title,text) => reasons.push({category,icon,title,text});
    const availability = player.availability || {};
    add("Role","R","Conditional on the listed role",availability.selection_reason || "Listed RB; appearance and workload are unconfirmed. Estimates reflect historical usage.");
    const context = player.season_context || {};
    const carries = numberOrNull(context.last3_carries_avg), targets = numberOrNull(context.last3_targets_avg);
    const workload = [];
    if (carries !== null) workload.push(`${format1(carries)} carries per recorded appearance over the last 3.`);
    if (targets !== null) workload.push(`${format1(targets)} targets per recorded appearance over the last 3.`);
    if (workload.length) add("Workload","V","Prior rushing and receiving opportunity",workload.join(" "));
    if (availability.practice_status) add("Practice","P",availability.practice_review_required ? "Practice participation needs review" : "Reported practice participation",`${quarterbackPracticeRead(player)}. ${availability.report_time_verified === true ? "" : "Report timestamp unverified. "}Practice participation does not confirm game availability.`);
    for (const metric of ["rushing_yards","receiving_yards","receptions"]) {
        const config = getMetricConfig(player,metric);
        if (config.projectionValue === null) continue;
        const pieces = [`${format1(config.projectionValue)} ${config.unit} is the central estimate.`,`${rbMethodDescription(player,metric)}.`];
        if (config.seasonAverage !== null) pieces.push(`Season average: ${format1(config.seasonAverage)}; forecast is ${comparisonText(config.projectionValue-config.seasonAverage,config.unit)} that average.`);
        if (config.last3Average !== null) pieces.push(`Last 3 recorded appearances: ${format1(config.last3Average)} ${config.unit} per game.`);
        add("Forecast",metric === "receptions" ? "C" : "Y",config.label,pieces.join(" "));
    }
    return reasons;
}

/* =========================================================
   HEADSHOT
========================================================= */

function renderHeadshot(player) {
    const img =
        detailPanel.querySelector(".player-headshot");
    const fallback =
        detailPanel.querySelector(
            ".player-headshot-fallback"
        );

    if (!img || !fallback) {
        return;
    }

    if (player.headshot_url) {
        img.src = player.headshot_url;
        img.alt = `${player.name} headshot`;
        img.style.display = "block";
        fallback.style.display = "none";

        img.onerror = () => {
            img.style.display = "none";
            fallback.style.display = "grid";
        };
    } else {
        img.style.display = "none";
        fallback.style.display = "grid";
    }
}

/* =========================================================
   PROJECTION DRIVERS
========================================================= */

// Explanations report supplied facts and arithmetic comparisons, never inferred feature impacts.
function renderReasons(player) {
    const list = detailPanel.querySelector(".detail-reasons");
    if (!list) return;
    list.innerHTML = buildWeeklyOutlook(player, selectedMetric).map(reason => `
        <li data-icon="${escapeHtml(reason.icon)}">
            <span class="reason-category">${escapeHtml(reason.category)}</span>
            <strong>${escapeHtml(reason.title)}</strong>
            <p>${escapeHtml(reason.text)}</p>
        </li>`).join("");
}

function buildProjectionReasons(player) {
    const reasons = [];
    const role = player.role || {};
    const context = player.season_context || {};
    const matchup = player.matchup || {};
    const targets = numberOrNull(player.projection?.targets?.value);
    const receptions = numberOrNull(player.projection?.receptions?.value);
    const ypr = numberOrNull(player.projection?.yards_per_reception);
    const yards = numberOrNull(player.projection?.receiving_yards?.value);
    const usage = getMetricConfig(player, "targets");
    const seasonYards = numberOrNull(context.receiving_yards_avg);
    const recentYards = getMetricConfig(player, "receiving_yards").last3Average;
    const add = (category, icon, title, text) => reasons.push({category, icon, title, text});

    if (role.tier || role.confidence) {
        const confidence = role.confidence ? `${role.confidence} workload confidence describes how established the role and recent history is. It is not a probability of hitting the projection.` : "Workload confidence is not supplied.";
        add("Role", "R", role.tier ? `${role.tier} role` : "Role confidence", confidence);
    }

    if (targets !== null) {
        const pieces = [`${format1(targets)} expected targets.`];
        if (usage.seasonAverage !== null) {
            const delta = targets - usage.seasonAverage;
            pieces.push(`Season average: ${format1(usage.seasonAverage)}; projection is ${comparisonText(delta, "targets")} the season average.`);
        }
        if (usage.last3Average !== null) pieces.push(`Last 3 average: ${format1(usage.last3Average)} targets.`);
        const trend = String(role.usage_trend || "").toLowerCase();
        if (["rising", "falling", "stable"].includes(trend)) pieces.push(`Usage trend: ${trend}.`);
        const share = numberOrNull(context.target_share);
        if (share !== null && share >= 0 && share <= 1) pieces.push(`Season target share: ${(share * 100).toFixed(1)}%.`);
        add("Usage", "V", "Expected opportunity", pieces.join(" "));
    }

    if (receptions !== null || ypr !== null) {
        const pieces = [];
        if (receptions !== null) pieces.push(`${format1(receptions)} projected receptions.`);
        if (receptions !== null && targets !== null && targets > 0) pieces.push(`Receptions ÷ targets implies ${(100 * receptions / targets).toFixed(0)}% catch conversion.`);
        if (ypr !== null) pieces.push(`${format1(ypr)} projected yards per reception.`);
        if (yards !== null && receptions !== null && ypr !== null) pieces.push(`Receptions × yards per catch produces the receiving-yard forecast; displayed inputs are rounded.`);
        add("Efficiency", "E", "From opportunities to yards", pieces.join(" "));
    }

    if (matchup.label || numberOrNull(matchup.index) !== null) {
        const label = String(matchup.label || "").trim();
        const descriptions = {
            favorable: "The opponent grade is favorable for this receiving matchup.",
            difficult: "The opponent grade indicates a difficult receiving matchup.",
            neutral: "The opponent grade is neutral for this receiving matchup."
        };
        const pieces = [descriptions[label.toLowerCase()] || "An opponent context grade is available."];
        if (numberOrNull(matchup.index) !== null) pieces.push(`Matchup index: ${format1(matchup.index)}.`);
        pieces.push("This grade does not quantify how many yards the matchup adds or removes.");
        add("Matchup", "M", label ? `${label} opponent context` : "Opponent context", pieces.join(" "));
    }

    if (seasonYards !== null || recentYards !== null) {
        const pieces = [];
        if (seasonYards !== null) pieces.push(`Season average: ${format1(seasonYards)} receiving yards.`);
        if (recentYards !== null) pieces.push(`Last 3 average: ${format1(recentYards)} receiving yards.`);
        if (seasonYards !== null && recentYards !== null) pieces.push(`Recent production is ${comparisonText(recentYards - seasonYards, "yards")} the season average.`);
        add("Recent form", "3", "Production in context", pieces.join(" "));
    }

    if (yards !== null) {
        const pieces = [`${format1(yards)} receiving yards is the central estimate.`];
        if (seasonYards !== null) pieces.push(`That is ${comparisonText(yards - seasonYards, "yards")} the season average.`);
        const range = getValidRange(player.projection?.receiving_yards);
        if (range) pieces.push(`Historical uncertainty: ${format1(range.low)}–${format1(range.high)} yards. This range is not a guarantee.`);
        add("Model read", "PS", "Read the estimate with its range", pieces.join(" "));
    }
    return reasons.length ? reasons : [{category:"Context", icon:"i", title:"Context unavailable", text:"Projection context is unavailable for this player."}];
}

function comparisonText(delta, unit) {
    if (Math.abs(delta) < 0.05) return "level with";
    return `${format1(Math.abs(delta))} ${unit} ${delta > 0 ? "above" : "below"}`;
}

function getValidRange(projection) {
    const low = numberOrNull(projection?.low);
    const high = numberOrNull(projection?.high);
    return low !== null && high !== null && low <= high ? {low, high} : null;
}

function formatRange(projection, unit) {
    const range = getValidRange(projection);
    return range ? `${format1(range.low)}–${format1(range.high)} ${unit}` : "Range unavailable";
}

function getRecentGames(player) {
    return (Array.isArray(player.recent_games) ? player.recent_games : [])
        .filter(game => game && typeof game === "object")
        .slice().sort((a, b) => (numberOrNull(a.season) ?? 0) - (numberOrNull(b.season) ?? 0) || (numberOrNull(a.week) ?? 0) - (numberOrNull(b.week) ?? 0));
}

function getMetricConfig(player, metric) {
    const context = player.season_context || {};
    const configs = {
        rushing_yards: {label:"Rushing Yards", unit:"rushing yards", shortUnit:"yds", season:[context.rushing_yards_avg], recent:[context.last3_rushing_yards_avg]},
        receiving_yards: {label:"Receiving Yards", unit:"receiving yards", shortUnit:"yds", season:[context.receiving_yards_avg, context.season_receiving_yards_avg], recent:[context.last3_receiving_yards_avg]},
        receptions: {label:"Receptions", unit:"receptions", shortUnit:"receptions", season:[context.receptions_avg, context.season_receptions_avg], recent:[context.last3_receptions_avg]},
        passing_yards: {label:"Passing Yards", unit:"passing yards", shortUnit:"yds", season:[context.passing_yards_avg], recent:[context.last3_passing_yards_avg]},
        attempts: {label:"Attempts", unit:"attempts", shortUnit:"att", season:[context.attempts_avg], recent:[context.last3_attempts_avg]},
        completions: {label:"Completions", unit:"completions", shortUnit:"cmp", season:[context.completions_avg], recent:[context.last3_completions_avg]},
        targets: {label:"Targets", unit:"targets", shortUnit:"targets", season:[context.targets_avg, context.season_targets_avg], recent:[context.last3_targets_avg]}
    };
    const actualKey = configs[metric] ? metric : primaryMetric(player);
    const config = configs[actualKey];
    const games = getRecentGames(player).slice(-3);
    // A recent window is never substituted for a full-season average.
    const recent = games.map(game => numberOrNull(game[actualKey]));
    const derivedLast3 = recent.length === 3 && recent.every(value => value !== null)
        ? recent.reduce((a,b) => a+b, 0) / 3 : null;
    const projection = player.projection?.[actualKey] || {};
    const range = getValidRange(projection);
    return {
        ...config, actualKey,
        projectionValue:numberOrNull(projection.value),
        projectionLow:range?.low ?? null, projectionHigh:range?.high ?? null,
        seasonAverage:firstFinite(...config.season),
        last3Average:firstFinite(...config.recent, derivedLast3),
        marketLine:numberOrNull(player.market?.[actualKey]?.line)
    };
}

function renderChart(player, metric) {
    const chart = detailPanel.querySelector(".projection-chart");
    if (!chart) return;
    const config = getMetricConfig(player, metric);
    setText(".chart-title", config.label);
    const hasRange = config.projectionLow !== null && config.projectionHigh !== null;
    const rangeText = (isQuarterback(player) || isRunningBack(player)) && !hasRange ? "Range not yet calibrated" : formatRange(player.projection?.[config.actualKey], config.shortUnit);
    const uncertaintyLegend = detailPanel.querySelector(".legend-whisker")?.parentElement;
    if (uncertaintyLegend) uncertaintyLegend.hidden = !hasRange;
    const rangeNote = detailPanel.querySelector(".chart-uncertainty-note");
    if (rangeNote) rangeNote.textContent = isRunningBack(player)
        ? "RB forecast ranges have not yet been calibrated. Recent-game bars show recorded RB appearances; missing appearances are not treated as zero."
        : isQuarterback(player)
        ? "QB forecast ranges have not yet been calibrated. Recent-game bars show recorded passing appearances; missing appearances are not treated as zero."
        : hasRange ? "The whisker uses the middle roughly 80% of historical forecast errors for this position. It is a guide to past model uncertainty, not a guaranteed range for this player or game."
        : "A historical uncertainty range is unavailable for this metric.";
    const availableGames = getRecentGames(player);
    const games = selectedHistoryWindow === "last5" ? availableGames.slice(-5) : availableGames;
    const mixedSeasons = new Set(games.map(game => numberOrNull(game.season)).filter(value => value !== null)).size > 1;
    const points = games.map((game, index) => ({
        label: `${numberOrNull(game.season) !== null ? `${game.season} ` : ""}${numberOrNull(game.week) !== null ? `Week ${game.week}` : "Completed game"}${game.opponent ? ` · vs ${game.opponent}` : ""}`,
        weekLabel: numberOrNull(game.week) !== null ? `W${game.week}` : "Game",
        seasonLabel: mixedSeasons && numberOrNull(game.season) !== null && (index === 0 || games[index - 1].season !== game.season) ? String(game.season) : "",
        value:numberOrNull(game[config.actualKey]), projection:false
    }));
    points.push({label:`Week ${projectionWeek} Projection`, value:config.projectionValue, projection:true});
    const references = [
        {label:"Season average", value:config.seasonAverage, kind:"season"},
        {label:"Last 3 average", value:config.last3Average, kind:"last3"},
        {label:"Market line", value:config.marketLine, kind:"market"}
    ];
    const numeric = [...points.map(p => p.value), config.projectionLow, config.projectionHigh, ...references.map(r => r.value)].filter(v => v !== null);
    const step = niceAxisStep((Math.max(1, ...numeric) - Math.min(0, ...numeric)) / 4);
    const minimum = Math.floor(Math.min(0, ...numeric) / step) * step;
    const maximum = Math.ceil((Math.max(1, ...numeric) + step * 0.25) / step) * step;
    const width = Math.max(280, chart.clientWidth || 600);
    const height = 330, left = 46, right = width - 18, top = 36, bottom = 266;
    const y = value => bottom - (value - minimum) / (maximum - minimum) * (bottom - top);
    const slot = (right - left) / points.length;
    const fmtAxis = value => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
    let svg = `<svg class="forecast-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="forecastTitle forecastDesc">
        <title id="forecastTitle">${escapeHtml(player.name)} — ${escapeHtml(config.label)}</title>
        <desc id="forecastDesc">Blue bars show completed results. The cyan bar shows the upcoming projection. ${hasRange ? "Its whisker shows historical forecast uncertainty." : "No calibrated uncertainty range is shown."} Reference lines and all exact values are listed below the chart.</desc>`;
    for (let tick = minimum; tick <= maximum + step / 100; tick += step) {
        svg += `<line class="axis-grid" x1="${left}" x2="${right}" y1="${y(tick)}" y2="${y(tick)}"/><text class="axis-tick" x="${left-8}" y="${y(tick)+4}" text-anchor="end">${fmtAxis(tick)}</text>`;
    }
    references.filter(ref => ref.value !== null).forEach(ref => {
        svg += `<line class="forecast-reference ${ref.kind}" data-value="${ref.value}" x1="${left}" x2="${right}" y1="${y(ref.value)}" y2="${y(ref.value)}"><title>${escapeHtml(ref.label)}: ${format1(ref.value)} ${config.shortUnit}</title></line>`;
    });
    points.forEach((point, i) => {
        const x = left + slot * (i + 0.5), barWidth = Math.min(48, slot * 0.54);
        const rangeTop = point.projection ? config.projectionHigh : null;
        svg += `<g class="forecast-point ${point.projection ? "upcoming" : "completed"}"><title>${escapeHtml(point.label)}: ${point.value === null ? "unavailable" : format1(point.value) + " " + config.shortUnit}</title>`;
        if (point.projection) svg += `<rect class="projection-lane" x="${x-slot*0.44}" y="${top-12}" width="${slot*0.88}" height="${bottom-top+18}" rx="8"/>`;
        if (point.value !== null) svg += `<rect class="forecast-bar ${point.projection ? "projected-bar" : "actual-bar"}" data-value="${point.value}" x="${x-barWidth/2}" y="${Math.min(y(point.value),y(0))}" width="${barWidth}" height="${Math.abs(y(point.value)-y(0))}" rx="4"/>`;
        if (point.projection && config.projectionLow !== null && config.projectionHigh !== null) {
            svg += `<g class="forecast-whisker"><title>Historical uncertainty: ${format1(config.projectionLow)}–${format1(config.projectionHigh)} ${config.shortUnit}</title><line x1="${x}" x2="${x}" y1="${y(config.projectionLow)}" y2="${y(config.projectionHigh)}"/><line x1="${x-11}" x2="${x+11}" y1="${y(config.projectionLow)}" y2="${y(config.projectionLow)}"/><line x1="${x-11}" x2="${x+11}" y1="${y(config.projectionHigh)}" y2="${y(config.projectionHigh)}"/></g>`;
        }
        const labelY = Math.max(16, Math.min(y(point.value ?? 0), rangeTop !== null ? y(rangeTop) : bottom) - 10);
        svg += `<text class="forecast-value" x="${x}" y="${labelY}" text-anchor="middle">${point.value === null ? "—" : format1(point.value)}</text>`;
        svg += `<text class="forecast-week" x="${x}" y="${bottom+24}" text-anchor="middle">${escapeHtml(point.projection ? `Week ${projectionWeek}` : point.weekLabel)}${point.projection ? `<tspan x="${x}" dy="16">Projection</tspan>` : point.seasonLabel ? `<tspan x="${x}" dy="16">${escapeHtml(point.seasonLabel)}</tspan>` : ""}</text></g>`;
    });
    svg += "</svg>";
    chart.innerHTML = svg;
    detailPanel.querySelector(".chart-reference-key").innerHTML = references.map(ref => `<span class="reference-chip ${ref.kind}"><i aria-hidden="true"></i>${escapeHtml(ref.label)} <strong>${ref.value === null ? "Unavailable" : `${format1(ref.value)} ${config.shortUnit}`}</strong></span>`).join("");
    const table = detailPanel.querySelector(".chart-table-wrap");
    table.innerHTML = `<table><caption>${escapeHtml(config.label)} — results and forecast</caption><thead><tr><th scope="col">Game / reference</th><th scope="col">${escapeHtml(config.label)}</th></tr></thead><tbody>${[...points, ...references].map(item => `<tr><th scope="row">${escapeHtml(item.label)}</th><td>${item.value === null ? "Unavailable" : format1(item.value)}</td></tr>`).join("")}<tr><th scope="row">Historical uncertainty</th><td>${escapeHtml(rangeText)}</td></tr></tbody></table>`;
    setText(".chart-readout-main", buildChartReadout(player, config));
    setText(".chart-readout-range", rangeText);
    setText(".chart-explanation", buildChartExplanation(player, config, games));
    renderMetricSummary(player, metric, games);
}

function niceAxisStep(raw) {
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    const scaled = raw / magnitude;
    return (scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 2.5 ? 2.5 : scaled <= 5 ? 5 : 10) * magnitude;
}

function buildChartReadout(player, config) {
    if (config.projectionValue === null) return "Projection unavailable";
    return config.last3Average === null ? `${format1(config.projectionValue)} ${config.shortUnit} projected`
        : `${comparisonText(config.projectionValue - config.last3Average, config.shortUnit)} last-3 average`;
}

function buildChartExplanation(player, config, games) {
    return `${games.length ? "Blue bars show past results; cyan shows this week's projection." : "Cyan shows this week's projection; past results are unavailable."}${config.marketLine !== null ? " Gold marks the market line." : ""}`;
}

function buildPlayerRead(player) {
    const configs = (isQuarterback(player) ? ["attempts", "completions", "passing_yards"] : isRunningBack(player) ? ["rushing_yards", "receiving_yards", "receptions"] : ["targets", "receptions", "receiving_yards"]).map(metric => getMetricConfig(player,metric));
    const available = configs.filter(config => config.projectionValue !== null).map(config => `${format1(config.projectionValue)} ${config.unit}`);
    return available.length ? `${player.name || "This player"}: ${available.join(" · ")}. These are central estimates; actual results can vary widely.` : "Projection values are unavailable for this player.";
}


/* =========================================================
   EMPTY DETAIL
========================================================= */

function renderEmptyDetail() {
    selectedPlayer = null;

    detailPanel.style.removeProperty(
        "--team-primary"
    );
    detailPanel.style.removeProperty(
        "--team-secondary"
    );

    detailPanel.style.removeProperty("--team-rgb");
    detailPanel.innerHTML = `
        <div class="empty-player-state">
            <div class="empty-player-icon">
                PS
            </div>

            <h2>
                No player selected
            </h2>

            <p>
                Adjust the filters or select a player
                from the board.
            </p>
        </div>
    `;
}

/* =========================================================
   HELPERS
========================================================= */

function setText(selector, value) {
    const element =
        detailPanel.querySelector(selector);

    if (element) {
        element.textContent =
            value ?? "—";
    }
}

function numberOrNull(value) {
    if (
        value === null ||
        value === undefined ||
        (typeof value === "string" && value.trim() === "") ||
        !["number", "string"].includes(typeof value)
    ) {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}

function numberValue(value) {
    return numberOrNull(value) ?? 0;
}

function isFiniteNumber(value) {
    return numberOrNull(value) !== null;
}

function firstFinite(...values) {
    for (const value of values) {
        const number =
            numberOrNull(value);

        if (number !== null) {
            return number;
        }
    }

    return null;
}

function format1(value) {
    const number =
        numberOrNull(value);

    return number === null
        ? "—"
        : number.toFixed(1);
}

function format0(value) {
    const number =
        numberOrNull(value);

    return number === null
        ? "—"
        : Math.round(number);
}

function signed(value) {
    const number =
        numberOrNull(value);

    if (number === null) {
        return "—";
    }

    return `${
        number >= 0 ? "+" : ""
    }${number.toFixed(1)}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* =========================================================
   EVENTS
========================================================= */

playerSearch.addEventListener(
    "input",
    applyFilters
);

positionFilter.addEventListener(
    "change",
    applyFilters
);

sortFilter.addEventListener(
    "change",
    applyFilters
);
gameFilter.addEventListener("change", applyFilters);
gapMetricFilter.addEventListener("change", applyFilters);
document.getElementById("exploreMarketGaps").addEventListener("click", () => {
    sortFilter.value = "gap_desc";
    applyFilters();
    sortFilter.focus();
});

/* =========================================================
   START
========================================================= */

let chartResizeFrame = null;
window.addEventListener("resize", () => {
    if (chartResizeFrame !== null) cancelAnimationFrame(chartResizeFrame);
    chartResizeFrame = requestAnimationFrame(() => {
        if (selectedPlayer) renderChart(selectedPlayer, selectedMetric);
        chartResizeFrame = null;
    });
});

loadPlayers();


// POCKET_SIGNAL_MARKET_COLOR_V1
// POCKET_SIGNAL_GAP_COLOR_V2
function setMarketBenchmarkColor(player) {
    const marketNumber = detailPanel.querySelector(".comparison-market-yards");
    if (marketNumber) {
        marketNumber.classList.remove("market-below", "market-above", "market-equal");
        marketNumber.removeAttribute("title");
    }
    const element = detailPanel.querySelector(".comparison-gap");
    if (!element) return;
    element.classList.remove("gap-negative", "gap-positive", "gap-neutral");
    element.removeAttribute("title");
    const market = player.market?.receiving_yards;
    const line = numberOrNull(market?.line);
    const projection = numberOrNull(player.projection?.receiving_yards?.value);
    if (line === null || projection === null) return;
    const difference = projection - line;
    const direction = Math.abs(difference) < 1e-9 ? "neutral"
        : difference < 0 ? "negative" : "positive";
    element.classList.add(`gap-${direction}`);
    const description = direction === "neutral" ? "Projection equals market benchmark"
        : `Projection is ${format1(Math.abs(difference))} yds ${difference < 0 ? "below" : "above"} market`;
    element.title = description;
    const status = detailPanel.querySelector(".market-status");
    if (status) {
        const source = market.source === "user_screenshot"
            ? "Screenshot benchmark" : status.textContent.trim();
        status.textContent = `${source} · ${description}`;
    }
}
