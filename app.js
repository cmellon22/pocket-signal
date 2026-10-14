const API_PATH =
    "data/api/sunday_signal_latest.json";


let payload = null;
let selectedGame = null;
let currentSort = "signal";


// ============================================================
// DOM
// ============================================================

const homeView =
    document.getElementById("homeView");

const gameView =
    document.getElementById("gameView");

const gamesGrid =
    document.getElementById("gamesGrid");

const weekTitle =
    document.getElementById("weekTitle");

const seasonValue =
    document.getElementById("seasonValue");

const sortDescription =
    document.getElementById("sortDescription");

const matchupPreview =
    document.getElementById("matchupPreview");

const generateGate =
    document.getElementById("generateGate");

const generateButton =
    document.getElementById("generateButton");

const signalLoading =
    document.getElementById("signalLoading");

const loadingMessage =
    document.getElementById("loadingMessage");

const analysisDashboard =
    document.getElementById("analysisDashboard");

const forecastPanel =
    document.getElementById("forecastPanel");

const marketPanel =
    document.getElementById("marketPanel");

const signalsPanel =
    document.getElementById("signalsPanel");

const qbPanel =
    document.getElementById("qbPanel");

const recentPanel =
    document.getElementById("recentPanel");

const weatherPanel =
    document.getElementById("weatherPanel");

const homeButton =
    document.getElementById("homeButton");

const backButton =
    document.getElementById("backButton");


// ============================================================
// SORT DOM
// ============================================================

const customSort =
    document.getElementById("customSort");

const customSortButton =
    document.getElementById("customSortButton");

const customSortText =
    document.getElementById("customSortText");

const customSortOptions =
    document.querySelectorAll(
        ".custom-sort-option"
    );


// ============================================================
// TEAM LOGOS
// ============================================================

const logoCodes = {
    ARI: "ari",
    ATL: "atl",
    BAL: "bal",
    BUF: "buf",
    CAR: "car",
    CHI: "chi",
    CIN: "cin",
    CLE: "cle",
    DAL: "dal",
    DEN: "den",
    DET: "det",
    GB: "gb",
    HOU: "hou",
    IND: "ind",
    JAX: "jax",
    KC: "kc",
    LV: "lv",
    LAC: "lac",
    LA: "lar",
    MIA: "mia",
    MIN: "min",
    NE: "ne",
    NO: "no",
    NYG: "nyg",
    NYJ: "nyj",
    PHI: "phi",
    PIT: "pit",
    SEA: "sea",
    SF: "sf",
    TB: "tb",
    TEN: "ten",
    WAS: "wsh"
};


function getTeamLogo(team) {

    const code =
        logoCodes[team]
        ||
        String(team).toLowerCase();

    return (
        "https://a.espncdn.com/i/teamlogos/nfl/500/"
        +
        code
        +
        ".png"
    );

}


// ============================================================
// TEAM GLOW COLORS
// ============================================================

const teamGlowColors = {

    ARI: "rgba(151, 35, 63, 0.90)",
    ATL: "rgba(198, 12, 48, 0.88)",
    BAL: "rgba(92, 70, 156, 0.90)",
    BUF: "rgba(0, 51, 141, 0.90)",
    CAR: "rgba(0, 133, 202, 0.90)",
    CHI: "rgba(200, 56, 3, 0.88)",
    CIN: "rgba(251, 79, 20, 0.90)",
    CLE: "rgba(255, 60, 0, 0.82)",
    DAL: "rgba(0, 53, 148, 0.90)",
    DEN: "rgba(251, 79, 20, 0.88)",
    DET: "rgba(0, 118, 182, 0.90)",
    GB: "rgba(32, 55, 49, 0.90)",
    HOU: "rgba(3, 32, 47, 0.95)",
    IND: "rgba(0, 44, 95, 0.92)",
    JAX: "rgba(0, 103, 120, 0.90)",
    KC: "rgba(227, 24, 55, 0.90)",
    LV: "rgba(166, 174, 176, 0.68)",
    LAC: "rgba(0, 128, 198, 0.92)",
    LA: "rgba(0, 53, 148, 0.90)",
    MIA: "rgba(0, 142, 151, 0.90)",
    MIN: "rgba(79, 38, 131, 0.92)",
    NE: "rgba(0, 34, 68, 0.95)",
    NO: "rgba(211, 188, 141, 0.78)",
    NYG: "rgba(1, 35, 82, 0.95)",
    NYJ: "rgba(18, 87, 64, 0.90)",
    PHI: "rgba(0, 76, 84, 0.92)",
    PIT: "rgba(255, 182, 18, 0.82)",
    SEA: "rgba(0, 34, 68, 0.92)",
    SF: "rgba(170, 0, 0, 0.90)",
    TB: "rgba(213, 10, 10, 0.88)",
    TEN: "rgba(75, 146, 219, 0.90)",
    WAS: "rgba(90, 20, 20, 0.92)"

};


function getTeamGlow(team) {

    return (
        teamGlowColors[team]
        ||
        "rgba(50, 204, 255, 0.65)"
    );

}


// ============================================================
// VALUE HELPERS
// ============================================================

function hasValue(value) {

    return (
        value !== null
        &&
        value !== undefined
        &&
        value !== ""
    );

}


function finiteNumber(value) {

    if (!hasValue(value)) {
        return null;
    }

    const number =
        Number(value);

    return (
        Number.isFinite(number)
        ?
        number
        :
        null
    );

}


// ============================================================
// LOAD
// ============================================================

async function loadPocketSignal() {

    try {

        const response =
            await fetch(
                API_PATH,
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {

            throw new Error(
                `HTTP ${response.status}`
            );

        }

        payload =
            await response.json();


        weekTitle.textContent =
            `Week ${payload.metadata.week}`;


        seasonValue.textContent =
            payload.metadata.season;


        renderGames();


        decorateAnalysisHeadings();

    }

    catch (error) {

        console.error(
            "Pocket Signal failed to load:",
            error
        );


        gamesGrid.innerHTML = `

            <div class="loading-card">
                Pocket Signal data could not be loaded.
            </div>

        `;

    }

}


// ============================================================
// HOME
// ============================================================

function renderGames() {

    if (
        !payload
        ||
        !Array.isArray(
            payload.games
        )
    ) {

        return;

    }


    const games =
        [...payload.games];


    games.sort(
        getSortFunction(
            currentSort
        )
    );


    updateSortDescription();


    gamesGrid.innerHTML =
        "";


    games.forEach(
        (game, index) => {

            gamesGrid.appendChild(
                buildGameCard(
                    game,
                    index === 0
                )
            );

        }
    );

}


// ============================================================
// GAME CARD
// ============================================================

function buildGameCard(
    game,
    isTopGame
) {

    const preview =
        game.preview
        ||
        {};


    const card =
        document.createElement(
            "article"
        );


    card.className =
        "game-card";


    const shouldHighlight =
        isTopGame
        &&
        (
            currentSort === "signal"
            ||
            currentSort === "marketWinner"
            ||
            currentSort === "marketMargin"
        );


    const shouldFlame =
        isTopGame
        &&
        currentSort === "signal";


    if (shouldHighlight) {

        card.classList.add(
            "featured-card"
        );

    }


    if (shouldFlame) {

        card.classList.add(
            "flame-card"
        );

    }


    card.innerHTML = `

        ${
            shouldFlame
            ?
            `
                <div
                    class="signal-flame"
                    aria-hidden="true"
                ></div>
            `
            :
            ""
        }


        <div class="card-signal-row">

            ${signalBadge(
                preview.signal_strength
            )}

        </div>


        <div class="card-team-row">


            <div
                class="card-team"
                style="
                    --team-glow:
                    ${getTeamGlow(
                        preview.away_team
                    )}
                "
            >

                <img
                    class="card-team-logo"
                    src="${getTeamLogo(
                        preview.away_team
                    )}"
                    alt="${preview.away_team} logo"
                >

            </div>


            <div class="card-vs">
                vs
            </div>


            <div
                class="card-team"
                style="
                    --team-glow:
                    ${getTeamGlow(
                        preview.home_team
                    )}
                "
            >

                <img
                    class="card-team-logo"
                    src="${getTeamLogo(
                        preview.home_team
                    )}"
                    alt="${preview.home_team} logo"
                >

            </div>


        </div>


        <div class="card-matchup">

            ${preview.away_team}
            &nbsp; vs &nbsp;
            ${preview.home_team}

        </div>


        <div class="card-time">

            ${formatGameDate(
                preview.gameday
            )}

            •

            ${formatGameTime(
                preview.gametime
            )}

        </div>


        <div class="card-metric-bar">

            ${buildCardMetric(
                game
            )}

        </div>

    `;


    card.addEventListener(
        "click",
        () => {

            openGame(game);

        }
    );


    return card;

}


// ============================================================
// CARD METRIC
// ============================================================

function buildCardMetric(game) {

    if (
        currentSort === "marketWinner"
    ) {

        const value =
            winnerDifference(game);


        return (
            value >= 0
            ?
            `${value.toFixed(1)} pp`
            :
            "Unavailable"
        );

    }


    if (
        currentSort === "marketMargin"
    ) {

        const value =
            marginDifference(game);


        return (
            value >= 0
            ?
            `${value.toFixed(1)} pts`
            :
            "Unavailable"
        );

    }


    if (
        currentSort === "signal"
    ) {

        return formatPercent(
            game.simulation
                ?.favorite_win_probability
        );

    }


    return "Open Matchup →";

}


// ============================================================
// OPEN GAME
// ============================================================

function openGame(game) {

    selectedGame =
        game;


    document.body.classList.add(
        "detail-mode"
    );


    homeView.classList.add(
        "hidden"
    );


    gameView.classList.remove(
        "hidden"
    );


    generateGate.classList.remove(
        "hidden"
    );


    signalLoading.classList.add(
        "hidden"
    );


    analysisDashboard.classList.add(
        "hidden"
    );


    analysisDashboard.classList.remove(
        "analysis-reveal"
    );


    renderMatchupPreview(game);


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


// ============================================================
// MATCHUP PREVIEW
// ============================================================

function renderMatchupPreview(game) {

    const preview =
        game.preview
        ||
        {};


    matchupPreview.innerHTML = `

        <div class="preview-heading">
            Selected Matchup
        </div>


        <div class="preview-teams">


            <div
                class="preview-team"
                style="
                    --team-glow:
                    ${getTeamGlow(
                        preview.away_team
                    )}
                "
            >

                <img
                    src="${getTeamLogo(
                        preview.away_team
                    )}"
                    alt="${preview.away_team}"
                >

                <div class="preview-team-code">
                    ${preview.away_team}
                </div>

            </div>


            <div class="preview-vs">
                VS
            </div>


            <div
                class="preview-team"
                style="
                    --team-glow:
                    ${getTeamGlow(
                        preview.home_team
                    )}
                "
            >

                <img
                    src="${getTeamLogo(
                        preview.home_team
                    )}"
                    alt="${preview.home_team}"
                >

                <div class="preview-team-code">
                    ${preview.home_team}
                </div>

            </div>


        </div>


        <div class="preview-meta">

            <span>
                ${formatGameDate(
                    preview.gameday
                )}
            </span>

            <span>•</span>

            <span>
                ${formatGameTime(
                    preview.gametime
                )}
            </span>

            <span>•</span>

            ${signalBadge(
                preview.signal_strength
            )}

        </div>

    `;

}


// ============================================================
// GENERATE
// ============================================================

async function generateSignal() {

    if (!selectedGame) {
        return;
    }


    generateGate.classList.add(
        "hidden"
    );


    analysisDashboard.classList.add(
        "hidden"
    );


    analysisDashboard.classList.remove(
        "analysis-reveal"
    );


    signalLoading.classList.remove(
        "hidden"
    );


    const messages = [

        "Evaluating matchup...",

        "Processing recent performance...",

        "Comparing quarterback efficiency...",

        "Evaluating team strength...",

        "Building scoring projection...",

        "Generating Pocket Signal..."

    ];


    for (
        const message
        of messages
    ) {

        loadingMessage.textContent =
            message;


        await sleep(210);

    }


    signalLoading.classList.add(
        "hidden"
    );


    renderFullAnalysis(
        selectedGame
    );


    analysisDashboard.classList.remove(
        "hidden"
    );


    void analysisDashboard.offsetWidth;


    analysisDashboard.classList.add(
        "analysis-reveal"
    );

}


// ============================================================
// FULL ANALYSIS
// ============================================================

function renderFullAnalysis(game) {

    renderForecast(game);

    renderMarket(game);

    renderSignals(game);

    renderQB(game);

    renderRecent(game);

    renderWeather(game);

    decorateAnalysisHeadings();

}


// ============================================================
// FORECAST
// ============================================================

function renderForecast(game) {

    const preview =
        game.preview
        ||
        {};


    const sim =
        game.simulation
        ||
        {};


    const away =
        preview.away_team;


    const home =
        preview.home_team;


    const awayProb =
        finiteNumber(
            sim.away_win_probability
        );


    const homeProb =
        finiteNumber(
            sim.home_win_probability
        );

    const disagreementNote =
    sim.coherence_status === "CONFLICT"
        ? `
            <div class="model-disagreement-note">
                <div class="model-disagreement-title">
                    Model Disagreement
                </div>

                <div class="model-disagreement-text">
                    Pocket Signal's winner model favors
                    <strong>${sim.favorite}</strong>,
                    while the margin model projects
                    <strong>
                        ${sim.margin_favorite}
                        by
                        ${formatNumber(
                            sim.projected_margin_absolute,
                            1
                        )}
                    </strong>.
                    Historically, the winner model has been slightly
    more accurate at picking the outright winner,
    but the difference is small. This disagreement
    suggests higher uncertainty in the matchup.
                </div>
            </div>
        `
        : "";


    const favorite =
        String(
            sim.favorite
            ||
            ""
        ).toUpperCase();


    const awayWinner =
        favorite ===
        String(away).toUpperCase();


    const homeWinner =
        favorite ===
        String(home).toUpperCase();


    forecastPanel.innerHTML = `

        <div class="forecast-title">
            Pocket Signal Forecast
        </div>


        <div class="forecast-main">


            <div
                class="
                    forecast-team
                    ${
                        awayWinner
                        ?
                        "projected-winner"
                        :
                        ""
                    }
                "
                style="
                    --team-glow:
                    ${getTeamGlow(away)}
                "
            >

                ${
                    awayWinner
                    ?
                    `
                        <div
                            class="projected-winner-label"
                        >
                            Projected Winner
                        </div>
                    `
                    :
                    ""
                }

                <img
                    src="${getTeamLogo(away)}"
                    alt="${away}"
                >

                <div class="forecast-team-code">
                    ${away}
                </div>

                <div class="forecast-prob">
                    ${formatPercent(
                        awayProb
                    )}
                </div>

                <div class="forecast-prob-label">
                    Win Probability
                </div>

            ${disagreementNote}

            </div>


            <div class="projected-score">

                <div class="projected-score-label">
                    Projected Final Score
                </div>

                <div class="projected-score-values">

                    <span>
                        ${formatNumber(
                            sim.projected_away_score,
                            1
                        )}
                    </span>

                    <span class="score-separator">
                        –
                    </span>

                    <span>
                        ${formatNumber(
                            sim.projected_home_score,
                            1
                        )}
                    </span>

                </div>

            </div>


            <div
                class="
                    forecast-team
                    ${
                        homeWinner
                        ?
                        "projected-winner"
                        :
                        ""
                    }
                "
                style="
                    --team-glow:
                    ${getTeamGlow(home)}
                "
            >

                ${
                    homeWinner
                    ?
                    `
                        <div
                            class="projected-winner-label"
                        >
                            Projected Winner
                        </div>
                    `
                    :
                    ""
                }

                <img
                    src="${getTeamLogo(home)}"
                    alt="${home}"
                >

                <div class="forecast-team-code">
                    ${home}
                </div>

                <div class="forecast-prob">
                    ${formatPercent(
                        homeProb
                    )}
                </div>

                <div class="forecast-prob-label">
                    Win Probability
                </div>

            </div>


        </div>


        <div class="probability-section">

            <div class="probability-labels">

                <span>
                    ${formatPercent(
                        awayProb
                    )}
                </span>

                <span>
                    ${formatPercent(
                        homeProb
                    )}
                </span>

            </div>


            <div class="probability-track">

                <div
                    class="probability-away"
                    style="
                        width:
                        ${safeProbability(
                            awayProb
                        )}%
                    "
                ></div>

                <div
                    class="probability-home"
                    style="
                        width:
                        ${safeProbability(
                            homeProb
                        )}%
                    "
                ></div>

            </div>

        </div>


        <div class="forecast-stats">


            <div class="forecast-stat">

                <div class="forecast-stat-label">
                    Projected Winner
                </div>

                <div class="forecast-stat-value">
                    ${sim.favorite || "—"}
                </div>

            </div>


            <div class="forecast-stat">

                <div class="forecast-stat-label">
                    Projected Margin
                </div>

                <div class="forecast-stat-value">

                    ${formatModelMargin(
                        sim.projected_margin,
                        away,
                        home
                    )}

                </div>

            </div>


            <div class="forecast-stat">

                <div class="forecast-stat-label">
                    Projected Total
                </div>

                <div class="forecast-stat-value">

                    ${formatNumber(
                        sim.projected_total,
                        1
                    )}

                </div>

            </div>


            <div class="forecast-stat">

                <div class="forecast-stat-label">
                    Signal Strength
                </div>

                <div class="forecast-stat-value">

                    ${signalBadge(
                        sim.signal_strength
                    )}

                </div>

            </div>


        </div>

    `;

}


// ============================================================
// MARKET
// ============================================================

function renderMarket(game) {

    const sim =
        game.simulation
        ||
        {};


    const market =
        game.market
        ||
        {};


    const moneyline =
        market.moneyline
        ||
        {};


    const spread =
        market.spread
        ||
        {};


    const total =
        market.total
        ||
        {};


    const away =
        game.preview
            ?.away_team;


    const home =
        game.preview
            ?.home_team;


    const modelHomeProb =
        finiteNumber(
            sim.home_win_probability
        );


    const marketHomeProb =
        finiteNumber(
            moneyline.home_vig_free_probability
        );


    const probDiff =
        (
            modelHomeProb !== null
            &&
            marketHomeProb !== null
        )
        ?
        modelHomeProb
        -
        marketHomeProb
        :
        null;


    const modelMargin =
        finiteNumber(
            sim.projected_margin
        );


    const homeSpread =
        finiteNumber(
            spread.home
        );


    const marketMargin =
        homeSpread !== null
        ?
        -homeSpread
        :
        null;


    const marginDiff =
        (
            modelMargin !== null
            &&
            marketMargin !== null
        )
        ?
        modelMargin
        -
        marketMargin
        :
        null;


    const modelTotal =
        finiteNumber(
            sim.projected_total
        );


    const marketTotal =
        finiteNumber(
            total.line
        );


    const totalDiff =
        (
            modelTotal !== null
            &&
            marketTotal !== null
        )
        ?
        modelTotal
        -
        marketTotal
        :
        null;


    marketPanel.innerHTML = `

        <table class="market-table">

            <thead>

                <tr>

                    <th></th>

                    <th>
                        Pocket Signal
                    </th>

                    <th>
                        Market
                    </th>

                    <th>
                        Difference
                    </th>

                </tr>

            </thead>


            <tbody>


                <tr>

                    <td>
                        Home Win Prob.
                    </td>

                    <td>
                        ${formatPercent(
                            modelHomeProb
                        )}
                    </td>

                    <td>
                        ${formatPercent(
                            marketHomeProb
                        )}
                    </td>

                    <td class="${differenceClass(
                        probDiff
                    )}">
                        ${formatSigned(
                            probDiff,
                            1
                        )} pp
                    </td>

                </tr>


                <tr>

                    <td>
                        Margin
                    </td>

                    <td>
                        ${formatModelMargin(
                            modelMargin,
                            away,
                            home
                        )}
                    </td>

                    <td>
                        ${formatMarketSpread(
                            homeSpread,
                            away,
                            home
                        )}
                    </td>

                    <td class="${differenceClass(
                        marginDiff
                    )}">
                        ${formatSigned(
                            marginDiff,
                            1
                        )}
                    </td>

                </tr>


                <tr>

                    <td>
                        Total
                    </td>

                    <td>
                        ${formatNumber(
                            modelTotal,
                            1
                        )}
                    </td>

                    <td>
                        ${formatNumber(
                            marketTotal,
                            1
                        )}
                    </td>

                    <td class="${differenceClass(
                        totalDiff
                    )}">
                        ${formatSigned(
                            totalDiff,
                            1
                        )}
                    </td>

                </tr>


            </tbody>

        </table>


        <div class="market-meta">

            Market Source:
            ${
                market.provider
                ||
                "Benchmark"
            }

            &nbsp; | &nbsp;

            Updated:
            ${
                market.updated_at
                ||
                "Unavailable"
            }

        </div>

    `;

}


// ============================================================
// KEY SIGNALS
// ============================================================

function renderSignals(game) {

    const signals =
        game.insights
            ?.key_signals;


    if (
        !Array.isArray(signals)
        ||
        signals.length === 0
    ) {

        signalsPanel.innerHTML =
            infoRow(
                "Signals",
                "Unavailable",
                "key-signal-muted"
            );

        return;

    }


    const favorite =
        String(
            game.simulation
                ?.favorite
            ||
            ""
        ).toUpperCase();


    signalsPanel.innerHTML =
        signals
            .slice(0, 6)
            .map(
                signal => {

                    const value =
                        signal.display
                        ||
                        formatAdvantage(
                            signal.advantage
                        );


                    const tone =
                        keySignalTone(
                            value,
                            favorite
                        );


                    return infoRow(
                        signal.label
                        ||
                        "Signal",

                        value,

                        tone
                    );

                }
            )
            .join("");

}


// ============================================================
// KEY SIGNAL TONE
// ============================================================

function keySignalTone(
    value,
    favorite
) {

    const text =
        String(
            value
            ||
            ""
        ).toUpperCase();


    if (
        text.includes(
            "UNAVAILABLE"
        )
    ) {

        return "key-signal-muted";

    }


    if (
        text === "EVEN"
        ||
        text.includes(
            "EVEN"
        )
    ) {

        return "key-signal-neutral";

    }


    if (
        favorite
        &&
        text.includes(
            favorite
        )
    ) {

        return "key-signal-supports";

    }


    if (
        text.includes(
            "ADVANTAGE"
        )
    ) {

        return "key-signal-opposes";

    }


    return "key-signal-neutral";

}


// ============================================================
// QB
// ============================================================

function renderQB(game) {

    const away =
        game.preview
            ?.away_team;


    const home =
        game.preview
            ?.home_team;


    const qbs =
        game.insights
            ?.quarterbacks
        ||
        {};


    const awayQB =
        qbs.away
        ||
        {};


    const homeQB =
        qbs.home
        ||
        {};


    qbPanel.innerHTML = `

        <div class="qb-matchup">


            <div class="qb-team">

                <div class="qb-team-header">

                    <img
                        src="${getTeamLogo(away)}"
                        alt="${away}"
                    >

                    <strong>
                        ${away}
                    </strong>

                </div>


                <div class="qb-name">
                    ${
                        awayQB.name
                        ||
                        "Unavailable"
                    }
                </div>


                ${qbDetail(
                    "EPA/play",
                    awayQB.epa_per_play
                )}


                ${qbDetail(
                    "Pass YPG",
                    awayQB.pass_ypg
                )}


                ${qbDetail(
                    "TD / INT",
                    awayQB.td_int
                )}

            </div>


            <div class="qb-team">

                <div class="qb-team-header">

                    <img
                        src="${getTeamLogo(home)}"
                        alt="${home}"
                    >

                    <strong>
                        ${home}
                    </strong>

                </div>


                <div class="qb-name">
                    ${
                        homeQB.name
                        ||
                        "Unavailable"
                    }
                </div>


                ${qbDetail(
                    "EPA/play",
                    homeQB.epa_per_play
                )}


                ${qbDetail(
                    "Pass YPG",
                    homeQB.pass_ypg
                )}


                ${qbDetail(
                    "TD / INT",
                    homeQB.td_int
                )}

            </div>


        </div>


        <div class="qb-advantage">

            Advantage:

            ${formatAdvantage(
                qbs.advantage
            )}

        </div>

    `;

}


// ============================================================
// RECENT FORM
// ============================================================

function renderRecent(game) {

    const away =
        game.preview
            ?.away_team;


    const home =
        game.preview
            ?.home_team;


    const recent =
        game.insights
            ?.recent_form
        ||
        {};


    recentPanel.innerHTML = `

        <div class="recent-grid">


            <div class="recent-team">

                <img
                    src="${getTeamLogo(away)}"
                    alt="${away}"
                >

                <strong>
                    ${away}
                </strong>

                <div class="recent-number">

                    ${
                        hasValue(
                            recent.away
                        )
                        ?
                        formatSigned(
                            recent.away,
                            3
                        )
                        :
                        "—"
                    }

                </div>

                <div class="recent-caption">
                    EPA/play recent
                </div>

            </div>


            <div class="recent-team">

                <img
                    src="${getTeamLogo(home)}"
                    alt="${home}"
                >

                <strong>
                    ${home}
                </strong>

                <div class="recent-number">

                    ${
                        hasValue(
                            recent.home
                        )
                        ?
                        formatSigned(
                            recent.home,
                            3
                        )
                        :
                        "—"
                    }

                </div>

                <div class="recent-caption">
                    EPA/play recent
                </div>

            </div>


        </div>


        ${
            infoRow(
                "Advantage",
                formatAdvantage(
                    recent.advantage
                )
            )
        }


        ${
            hasValue(
                recent.difference
            )
            ?
            infoRow(
                "EPA/play difference",
                formatSigned(
                    recent.difference,
                    3
                )
            )
            :
            ""
        }

    `;

}


// ============================================================
// WEATHER
// ============================================================

function renderWeather(game) {

    const weather =
        game.insights
            ?.weather
        ||
        {};


    weatherPanel.innerHTML = `

        ${
            infoRow(
                "Temperature",
                hasValue(
                    weather.temperature_f
                )
                ?
                `${weather.temperature_f}°F`
                :
                "Unavailable"
            )
        }


        ${
            infoRow(
                "Wind",
                hasValue(
                    weather.wind_mph
                )
                ?
                `${weather.wind_mph} mph`
                :
                "Unavailable"
            )
        }


        ${
            infoRow(
                "Roof",
                formatText(
                    weather.roof
                )
            )
        }


        ${
            infoRow(
                "Surface",
                formatText(
                    weather.surface
                )
            )
        }

    `;

}


// ============================================================
// ANALYSIS HEADING ICONS
// ============================================================

function decorateAnalysisHeadings() {

    addHeadingIcon(
        marketPanel,
        "↔"
    );


    addHeadingIcon(
        signalsPanel,
        "⌁"
    );


    addHeadingIcon(
        qbPanel,
        "Q"
    );


    addHeadingIcon(
        recentPanel,
        "↗"
    );


    addHeadingIcon(
        weatherPanel,
        "◌"
    );

}


function addHeadingIcon(
    panel,
    icon
) {

    if (!panel) {
        return;
    }


    const card =
        panel.closest(
            ".analysis-card"
        );


    if (!card) {
        return;
    }


    const heading =
        card.querySelector(
            ".analysis-heading"
        );


    if (!heading) {
        return;
    }


    if (
        heading.querySelector(
            ".section-icon"
        )
    ) {

        return;

    }


    const iconElement =
        document.createElement(
            "span"
        );


    iconElement.className =
        "section-icon";


    iconElement.textContent =
        icon;


    heading.prepend(
        iconElement
    );

}


// ============================================================
// SORTING
// ============================================================

function getSortFunction(mode) {

    if (
        mode === "marketWinner"
    ) {

        return (
            a,
            b
        ) =>
            winnerDifference(b)
            -
            winnerDifference(a);

    }


    if (
        mode === "marketMargin"
    ) {

        return (
            a,
            b
        ) =>
            marginDifference(b)
            -
            marginDifference(a);

    }


    if (
        mode === "time"
    ) {

        return (
            a,
            b
        ) =>
            getGameTimestamp(a)
            -
            getGameTimestamp(b);

    }


    if (
        mode === "alphabetical"
    ) {

        return (
            a,
            b
        ) =>
            (
                a.preview.away_team
                +
                a.preview.home_team
            )
            .localeCompare(
                b.preview.away_team
                +
                b.preview.home_team
            );

    }


    return (
        a,
        b
    ) => {

        const strengthDiff =
            signalRank(
                b.preview
                    ?.signal_strength
            )
            -
            signalRank(
                a.preview
                    ?.signal_strength
            );


        if (
            strengthDiff !== 0
        ) {

            return strengthDiff;

        }


        return (
            finiteNumber(
                b.simulation
                    ?.favorite_win_probability
            )
            ??
            0
        )
        -
        (
            finiteNumber(
                a.simulation
                    ?.favorite_win_probability
            )
            ??
            0
        );

    };

}


// ============================================================
// MARKET DIFFERENCES
// ============================================================

function winnerDifference(game) {

    const model =
        finiteNumber(
            game.simulation
                ?.home_win_probability
        );


    const market =
        finiteNumber(
            game.market
                ?.moneyline
                ?.home_vig_free_probability
        );


    if (
        model === null
        ||
        market === null
    ) {

        return -1;

    }


    return Math.abs(
        model - market
    );

}


function marginDifference(game) {

    const model =
        finiteNumber(
            game.simulation
                ?.projected_margin
        );


    const spread =
        finiteNumber(
            game.market
                ?.spread
                ?.home
        );


    if (
        model === null
        ||
        spread === null
    ) {

        return -1;

    }


    return Math.abs(
        model
        -
        (-spread)
    );

}


// ============================================================
// SIGNAL RANK
// ============================================================

function signalRank(strength) {

    const value =
        String(
            strength
            ||
            ""
        ).toLowerCase();


    if (
        value === "strong"
    ) {

        return 3;

    }


    if (
        value === "moderate"
        ||
        value === "medium"
    ) {

        return 2;

    }


    return 1;

}


// ============================================================
// SIGNAL BADGE
// ============================================================

function signalBadge(strength) {

    const raw =
        String(
            strength
            ||
            "Weak"
        );


    const lower =
        raw.toLowerCase();


    let className =
        "signal-weak";


    let displayValue =
        "WEAK";


    if (
        lower === "strong"
    ) {

        className =
            "signal-strong";


        displayValue =
            "STRONG";

    }

    else if (
        lower === "moderate"
        ||
        lower === "medium"
    ) {

        className =
            "signal-moderate";


        displayValue =
            "MEDIUM";

    }


    return `

        <span
            class="
                signal-badge
                ${className}
            "
        >
            ${displayValue}
        </span>

    `;

}


// ============================================================
// INFO ROW
// ============================================================

function infoRow(
    label,
    value,
    extraClass = ""
) {

    return `

        <div class="info-row">

            <span>
                ${label}
            </span>

            <strong class="${extraClass}">
                ${value}
            </strong>

        </div>

    `;

}


// ============================================================
// QB DETAIL
// ============================================================

function qbDetail(
    label,
    value
) {

    if (
        !hasValue(value)
    ) {

        return "";

    }


    return `

        <div class="qb-detail">

            <span>
                ${label}
            </span>

            <strong>
                ${value}
            </strong>

        </div>

    `;

}


// ============================================================
// FORMATTING
// ============================================================

function differenceClass(value) {

    const number =
        finiteNumber(value);


    if (
        number === null
    ) {

        return "";

    }


    return (
        number >= 0
        ?
        "positive"
        :
        "negative"
    );

}


function formatPercent(value) {

    const number =
        finiteNumber(value);


    return (
        number !== null
        ?
        `${number.toFixed(1)}%`
        :
        "Unavailable"
    );

}


function formatNumber(
    value,
    decimals = 1
) {

    const number =
        finiteNumber(value);


    return (
        number !== null
        ?
        number.toFixed(decimals)
        :
        "Unavailable"
    );

}


function safeProbability(value) {

    const number =
        finiteNumber(value);


    if (
        number === null
    ) {

        return 50;

    }


    return Math.min(
        100,
        Math.max(
            0,
            number
        )
    );

}


function formatSigned(
    value,
    decimals = 1
) {

    const number =
        finiteNumber(value);


    if (
        number === null
    ) {

        return "—";

    }


    return (
        number > 0
        ?
        `+${number.toFixed(decimals)}`
        :
        number.toFixed(decimals)
    );

}


function formatModelMargin(
    value,
    away,
    home
) {

    const margin =
        finiteNumber(value);


    if (
        margin === null
    ) {

        return "Unavailable";

    }


    if (
        Math.abs(margin)
        <
        0.05
    ) {

        return "Even";

    }


    return (
        margin > 0
        ?
        `${home} -${Math.abs(
            margin
        ).toFixed(1)}`
        :
        `${away} -${Math.abs(
            margin
        ).toFixed(1)}`
    );

}


function formatMarketSpread(
    value,
    away,
    home
) {

    const spread =
        finiteNumber(value);


    if (
        spread === null
    ) {

        return "Unavailable";

    }


    if (
        spread < 0
    ) {

        return `${home} ${spread.toFixed(1)}`;

    }


    if (
        spread > 0
    ) {

        return `${away} -${Math.abs(
            spread
        ).toFixed(1)}`;

    }


    return "Even";

}


function formatAdvantage(value) {

    if (
        !hasValue(value)
    ) {

        return "Unavailable";

    }


    const text =
        String(value);


    if (
        text.toLowerCase()
        ===
        "even"
    ) {

        return "Even";

    }


    if (
        text.toLowerCase()
            .includes(
                "advantage"
            )
    ) {

        return text;

    }


    return `${text} advantage`;

}


function formatText(value) {

    if (
        !hasValue(value)
    ) {

        return "Unavailable";

    }


    return String(value)

        .replace(
            /_/g,
            " "
        )

        .replace(
            /\b\w/g,
            char =>
                char.toUpperCase()
        );

}


// ============================================================
// DATE / TIME
// ============================================================

function formatGameDate(
    dateString
) {

    if (
        !dateString
    ) {

        return "Date TBD";

    }


    const date =
        new Date(
            `${dateString}T12:00:00`
        );


    return new Intl.DateTimeFormat(
        "en-US",
        {
            weekday: "long",
            month: "short",
            day: "numeric"
        }
    ).format(date);

}


function formatGameTime(time) {

    if (
        !time
    ) {

        return "TBD";

    }


    const parts =
        String(time)
            .split(":");


    let hour =
        parseInt(
            parts[0],
            10
        );


    const minute =
        parts[1]
        ||
        "00";


    const suffix =
        hour >= 12
        ?
        "PM"
        :
        "AM";


    hour =
        hour % 12;


    if (
        hour === 0
    ) {

        hour =
            12;

    }


    return `${hour}:${minute} ${suffix}`;

}


function getGameTimestamp(game) {

    const date =
        game.preview
            ?.gameday;


    const time =
        game.preview
            ?.gametime;


    if (
        !date
        ||
        !time
    ) {

        return Number.MAX_SAFE_INTEGER;

    }


    const timestamp =
        new Date(
            `${date}T${time}:00`
        ).getTime();


    return (
        Number.isNaN(timestamp)
        ?
        Number.MAX_SAFE_INTEGER
        :
        timestamp
    );

}


// ============================================================
// SORT DESCRIPTION
// ============================================================

function updateSortDescription() {

    const descriptions = {

        signal:
            "Strongest Pocket Signal forecasts first.",

        marketWinner:
            "Largest model vs market win-probability gaps first.",

        marketMargin:
            "Largest model vs market projected-margin gaps first.",

        time:
            "Earliest games first.",

        alphabetical:
            "Games sorted alphabetically."

    };


    sortDescription.textContent =
        descriptions[currentSort]
        ||
        "";

}


// ============================================================
// SORT EVENTS
// ============================================================

if (
    customSortButton
) {

    customSortButton.addEventListener(
        "click",
        event => {

            event.stopPropagation();


            customSort.classList.toggle(
                "open"
            );

        }
    );

}


customSortOptions.forEach(
    option => {

        option.addEventListener(
            "click",
            event => {

                event.stopPropagation();


                currentSort =
                    option.dataset.value;


                customSortText.textContent =
                    option.textContent.trim();


                customSortOptions.forEach(
                    item => {

                        item.classList.remove(
                            "active"
                        );

                    }
                );


                option.classList.add(
                    "active"
                );


                customSort.classList.remove(
                    "open"
                );


                renderGames();

            }
        );

    }
);


document.addEventListener(
    "click",
    event => {

        if (
            customSort
            &&
            !customSort.contains(
                event.target
            )
        ) {

            customSort.classList.remove(
                "open"
            );

        }

    }
);


// ============================================================
// DETAIL EVENTS
// ============================================================

if (
    generateButton
) {

    generateButton.addEventListener(
        "click",
        generateSignal
    );

}


if (
    backButton
) {

    backButton.addEventListener(
        "click",
        showHome
    );

}


if (
    homeButton
) {

    homeButton.addEventListener(
        "click",
        showHome
    );

}


// ============================================================
// SHOW HOME
// ============================================================

function showHome() {

    document.body.classList.remove(
        "detail-mode"
    );


    gameView.classList.add(
        "hidden"
    );


    homeView.classList.remove(
        "hidden"
    );


    analysisDashboard.classList.remove(
        "analysis-reveal"
    );


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


// ============================================================
// UTIL
// ============================================================

function sleep(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );

}


// ============================================================
// START
// ============================================================

loadPocketSignal();