const TEAM_DATA_PATH =
    "data/api/team_rankings_2026.json";


let allTeams = [];

let selectedConference = "ALL";
let currentSort = "power";


const rankingsList =
    document.getElementById("rankingsList");

const afcDivisions =
    document.getElementById("afcDivisions");

const nfcDivisions =
    document.getElementById("nfcDivisions");

const teamSort =
    document.getElementById("teamSort");


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
        || team.toLowerCase();

    return (
        "https://a.espncdn.com/i/teamlogos/nfl/500/"
        + code
        + ".png"
    );

}


async function loadTeams() {

    try {

        const response =
            await fetch(
                TEAM_DATA_PATH,
                {
                    cache: "no-store"
                }
            );

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}`
            );
        }

        const payload =
            await response.json();

        allTeams =
            payload.teams || [];

        render();

    } catch (error) {

        console.error(
            "Could not load team rankings:",
            error
        );

        rankingsList.innerHTML = `
            <div class="team-load-error">
                Could not load team rankings.
            </div>
        `;

    }

}


function formHTML(team) {

    const games =
        team.last_five || [];

    if (!games.length) {
        return `<span class="form-empty">—</span>`;
    }

    return games.map(result => {

        let className = "form-loss";

        if (result === "W") {
            className = "form-win";
        }

        if (result === "T") {
            className = "form-tie";
        }

        return `
            <span class="form-dot ${className}">
                ${result}
            </span>
        `;

    }).join("");

}


function sortTeams(teams) {

    const sorted =
        [...teams];

    sorted.sort((a, b) => {

        if (currentSort === "power") {

            return (
                b.power_score
                - a.power_score
            );

        }


        if (currentSort === "pointDiff") {

            return (
                b.point_diff
                - a.point_diff
            );

        }


        if (currentSort === "pointsFor") {

            return (
                b.points_for
                - a.points_for
            );

        }


        if (currentSort === "pointsAgainst") {

            return (
                a.points_against
                - b.points_against
            );

        }


        if (currentSort === "recent") {

            if (
                b.recent_pct
                !==
                a.recent_pct
            ) {

                return (
                    b.recent_pct
                    - a.recent_pct
                );

            }

        }


        if (
            b.win_pct
            !==
            a.win_pct
        ) {

            return (
                b.win_pct
                - a.win_pct
            );

        }


        if (
            b.point_diff
            !==
            a.point_diff
        ) {

            return (
                b.point_diff
                - a.point_diff
            );

        }


        return (
            b.points_for
            - a.points_for
        );

    });


    return sorted;

}


function renderRankings() {

    let teams =
        allTeams;

    if (
        selectedConference
        !==
        "ALL"
    ) {

        teams =
            teams.filter(
                team =>
                    team.conference
                    ===
                    selectedConference
            );

    }


    const sorted =
        sortTeams(teams);


    rankingsList.innerHTML =
        sorted.map(
            (team, index) => {

                const diff =
                    team.point_diff > 0
                        ? `+${team.point_diff}`
                        : team.point_diff;


                return `

                    <div class="ranking-row">

                        <div class="ranking-number">
                            ${
                                currentSort === "power"
                                    ? team.power_rank
                                    : index + 1
                            }
                        </div>


                        <div class="ranking-team">

                            <img
                                src="${getTeamLogo(team.team)}"
                                alt="${team.team}"
                            >

                            <div>

                                <strong>
                                    ${team.team}
                                </strong>

                                <span>
                                    ${team.conference}
                                    ${team.division}
                                </span>

                            </div>

                        </div>


                        <div class="power-score">
                            ${team.power_score.toFixed(1)}
                        </div>


                        <div class="ranking-record">
                            ${team.record}
                        </div>


                        <div>
                            ${team.division_record}
                        </div>


                        <div>
                            ${team.points_for}
                        </div>


                        <div>
                            ${team.points_against}
                        </div>


                        <div class="${
                            team.point_diff > 0
                                ? "positive-diff"
                                : team.point_diff < 0
                                    ? "negative-diff"
                                    : ""
                        }">
                            ${diff}
                        </div>


                        <div class="form-list">
                            ${formHTML(team)}
                        </div>

                    </div>

                `;

            }
        ).join("");

}


function divisionStandings(
    conference,
    division
) {

    const teams =
        allTeams.filter(
            team =>
                team.conference
                    === conference
                &&
                team.division
                    === division
        );


    return [...teams].sort((a, b) => {

        if (
            b.win_pct
            !==
            a.win_pct
        ) {
            return (
                b.win_pct
                - a.win_pct
            );
        }


        if (
            b.point_diff
            !==
            a.point_diff
        ) {
            return (
                b.point_diff
                - a.point_diff
            );
        }


        return (
            b.points_for
            - a.points_for
        );

    });

}


function divisionCard(
    conference,
    division
) {

    const teams =
        divisionStandings(
            conference,
            division
        );


    return `

        <article class="division-card">

            <div class="division-card-title">
                ${conference} ${division}
            </div>


            <div class="division-card-header">

                <span>TEAM</span>
                <span>W-L</span>
                <span>DIFF</span>

            </div>


            ${teams.map(team => {

                const diff =
                    team.point_diff > 0
                        ? `+${team.point_diff}`
                        : team.point_diff;

                return `

                    <div class="division-team-row">

                        <div class="division-team-name">

                            <img
                                src="${getTeamLogo(team.team)}"
                                alt="${team.team}"
                            >

                            <strong>
                                ${team.team}
                            </strong>

                        </div>


                        <span>
                            ${team.record}
                        </span>


                        <span class="${
                            team.point_diff > 0
                                ? "positive-diff"
                                : team.point_diff < 0
                                    ? "negative-diff"
                                    : ""
                        }">
                            ${diff}
                        </span>

                    </div>

                `;

            }).join("")}

        </article>

    `;

}


function renderDivisions() {

    const divisions = [
        "East",
        "North",
        "South",
        "West"
    ];


    afcDivisions.innerHTML =
        divisions.map(
            division =>
                divisionCard(
                    "AFC",
                    division
                )
        ).join("");


    nfcDivisions.innerHTML =
        divisions.map(
            division =>
                divisionCard(
                    "NFC",
                    division
                )
        ).join("");

}


function render() {

    renderRankings();
    renderDivisions();

}


document
    .querySelectorAll(
        "[data-conference]"
    )
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                selectedConference =
                    button.dataset.conference;


                document
                    .querySelectorAll(
                        "[data-conference]"
                    )
                    .forEach(item => {

                        item.classList.remove(
                            "active"
                        );

                    });


                button.classList.add(
                    "active"
                );


                renderRankings();

            }
        );

    });


teamSort.addEventListener(
    "change",
    () => {

        currentSort =
            teamSort.value;

        renderRankings();

    }
);


loadTeams();