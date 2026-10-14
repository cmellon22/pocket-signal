const RESULTS_PATH = "data/api/results_prototype.json";

let allGames = [];
let metadata = {};

const summaryCards =
  document.getElementById("summaryCards");

const seasonFilter =
  document.getElementById("seasonFilter");

const weekFilter =
  document.getElementById("weekFilter");

const signalFilter =
  document.getElementById("signalFilter");

const resultFilter =
  document.getElementById("resultFilter");

const signalPerformance =
  document.getElementById("signalPerformance");

const weeklyPerformance =
  document.getElementById("weeklyPerformance");

const resultsList =
  document.getElementById("resultsList");

const visibleRecord =
  document.getElementById("visibleRecord");

const notableCalls =
  document.getElementById("notableCalls");

const signalModal =
  document.getElementById("signalModal");

const signalModalContent =
  document.getElementById("signalModalContent");


/* ============================================================
   LOAD RESULTS
============================================================ */

async function loadResults() {
  try {
    const response = await fetch(
      RESULTS_PATH,
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

    metadata =
      payload.metadata || {};

    allGames =
      payload.games || [];

    populateFilters();

    render();
  }

  catch (error) {
    console.error(
      "Could not load Pocket Signal results:",
      error
    );

    resultsList.innerHTML = `
      <div class="empty-results">
        Could not load results data.
      </div>
    `;
  }
}


/* ============================================================
   FILTER SETUP
============================================================ */

function populateFilters() {
  const seasons = [
    ...new Set(
      allGames.map(
        game =>
          game.season
      )
    )
  ].sort(
    (a, b) =>
      b - a
  );

  seasonFilter.innerHTML =
    seasons
      .map(
        season => `
          <option value="${season}">
            ${season}
          </option>
        `
      )
      .join("");

  seasonFilter.value =
    String(
      metadata.season ||
      seasons[0] ||
      ""
    );

  updateWeekOptions();
}


function updateWeekOptions() {
  const season =
    Number(
      seasonFilter.value
    );

  const weeks = [
    ...new Set(
      allGames
        .filter(
          game =>
            game.season === season
        )
        .map(
          game =>
            game.week
        )
    )
  ].sort(
    (a, b) =>
      a - b
  );

  weekFilter.innerHTML = `
    <option value="all">
      All Weeks
    </option>

    ${
      weeks
        .map(
          week => `
            <option value="${week}">
              Week ${week}
            </option>
          `
        )
        .join("")
    }
  `;
}


/* ============================================================
   FILTER GAMES
============================================================ */

function getFilteredGames() {
  const season =
    Number(
      seasonFilter.value
    );

  const week =
    weekFilter.value;

  const signal =
    signalFilter.value;

  const result =
    resultFilter.value;

  return allGames.filter(
    game => {

      if (
        game.season !== season
      ) {
        return false;
      }

      if (
        week !== "all" &&
        game.week !== Number(week)
      ) {
        return false;
      }

      if (
        signal !== "all" &&
        game.signal_strength !== signal
      ) {
        return false;
      }

      if (
        result === "correct" &&
        !(
          game.result !== "TIE" &&
          game.winner_correct
        )
      ) {
        return false;
      }

      if (
        result === "missed" &&
        !(
          game.result !== "TIE" &&
          !game.winner_correct
        )
      ) {
        return false;
      }

      if (
        result === "tie" &&
        game.result !== "TIE"
      ) {
        return false;
      }

      return true;
    }
  );
}


/* ============================================================
   METRIC HELPERS
============================================================ */

function decidedGames(games) {
  return games.filter(
    game =>
      game.result !== "TIE"
  );
}


function accuracy(games) {
  const decided =
    decidedGames(games);

  if (!decided.length) {
    return null;
  }

  const wins =
    decided.filter(
      game =>
        game.winner_correct
    ).length;

  return (
    wins /
    decided.length
  ) * 100;
}


function record(games) {
  const ties =
    games.filter(
      game =>
        game.result === "TIE"
    ).length;

  const wins =
    games.filter(
      game =>
        game.result !== "TIE" &&
        game.winner_correct
    ).length;

  const losses =
    games.filter(
      game =>
        game.result !== "TIE" &&
        !game.winner_correct
    ).length;

  return {
    wins,
    losses,
    ties
  };
}


function formatRecord(games) {
  const {
    wins,
    losses,
    ties
  } = record(games);

  return (
    `${wins}-${losses}` +
    (
      ties
        ?
        `-${ties}`
        :
        ""
    )
  );
}


function average(values) {
  const cleaned =
    values.filter(
      Number.isFinite
    );

  if (!cleaned.length) {
    return null;
  }

  return (
    cleaned.reduce(
      (
        sum,
        value
      ) =>
        sum + value,
      0
    )
    /
    cleaned.length
  );
}


function matchup(game) {
  return (
    `${game.away_team} @ ${game.home_team}`
  );
}


function actualWinnerText(game) {
  if (
    game.result === "TIE"
  ) {
    return "Tie";
  }

  return (
    `${game.result} by ` +
    `${Math.abs(
      game.home_score -
      game.away_score
    )}`
  );
}


/* ============================================================
   MASTER RENDER
============================================================ */

function render() {
  const games =
    getFilteredGames();

  renderSummary(games);

  renderNotableCalls(games);

  renderSignalPerformance(games);

  renderWeeklyPerformance();

  renderGameResults(games);
}


/* ============================================================
   SUMMARY CARDS
============================================================ */

function renderSummary(games) {
  const winnerAccuracy =
    accuracy(games);

  const strongGames =
    games.filter(
      game =>
        game.signal_strength ===
        "Strong"
    );

  const strongAccuracy =
    accuracy(
      strongGames
    );

  const marginMae =
    average(
      games.map(
        game =>
          game.margin_error_absolute
      )
    );

  const totalMae =
    average(
      games.map(
        game =>
          game.total_error_absolute
      )
    );

  const decided =
    decidedGames(
      games
    ).length;

  const cards = [
    {
      label:
        "Winner Accuracy",

      value:
        winnerAccuracy === null
          ?
          "—"
          :
          `${winnerAccuracy.toFixed(1)}%`,

      sub:
        formatRecord(games),

      hint:
        `${decided} decided game${decided === 1 ? "" : "s"} • ties excluded`
    },

    {
      label:
        "Strong Signals",

      value:
        strongAccuracy === null
          ?
          "—"
          :
          `${strongAccuracy.toFixed(1)}%`,

      sub:
        strongGames.length
          ?
          formatRecord(
            strongGames
          )
          :
          "No games",

      hint:
        `${strongGames.length} total Strong signal${strongGames.length === 1 ? "" : "s"}`
    },

    {
      label:
        "Margin MAE",

      value:
        marginMae === null
          ?
          "—"
          :
          marginMae.toFixed(1),

      sub:
        "Average absolute margin error",

      hint:
        "Lower is better"
    },

    {
      label:
        "Total MAE",

      value:
        totalMae === null
          ?
          "—"
          :
          totalMae.toFixed(1),

      sub:
        "Average absolute total error",

      hint:
        "Lower is better"
    }
  ];

  summaryCards.innerHTML =
    cards
      .map(
        card => `
          <article class="summary-card">

            <div class="summary-label">
              ${card.label}
            </div>

            <div class="summary-value">
              ${card.value}
            </div>

            <div class="summary-sub">
              ${card.sub}
            </div>

            <div class="summary-hint">
              ${card.hint}
            </div>

          </article>
        `
      )
      .join("");
}


/* ============================================================
   NOTABLE CALLS
============================================================ */

function renderNotableCalls(games) {
  if (!games.length) {
    notableCalls.innerHTML = `
      <div class="empty-results">
        No notable calls for these filters.
      </div>
    `;

    return;
  }


  const decided =
    games.filter(
      game =>
        game.result !== "TIE"
    );


  const closest =
    [...games]

      .filter(
        game =>
          Number.isFinite(
            game.margin_error_absolute
          )
      )

      .sort(
        (a, b) =>
          a.margin_error_absolute -
          b.margin_error_absolute
      )[0];


  const underdogWins =
    [...decided]

      .filter(
        game =>

          game.model_winner !==
          game.benchmark_favorite

          &&

          game.winner_correct
      )

      .sort(
        (a, b) =>

          (
            b.model_benchmark_gap || 0
          )

          -

          (
            a.model_benchmark_gap || 0
          )
      );

  const bestUnderdogWin =
    underdogWins[0];


  const biggestMiss =
    [...decided]

      .filter(
        game =>
          !game.winner_correct
      )

      .sort(
        (a, b) =>
          b.margin_error_absolute -
          a.margin_error_absolute
      )[0];


  const cards = [];


  if (closest) {
    cards.push({
      label:
        "CLOSEST MARGIN PREDICTION",

      title:
        matchup(
          closest
        ),

      html: `
        <div class="notable-line">

          <span>
            Pocket Signal
          </span>

          <strong>
            ${closest.margin_favorite}
            by
            ${closest.projected_margin_absolute.toFixed(1)}
          </strong>

        </div>

        <div class="notable-line">

          <span>
            Actual
          </span>

          <strong>
            ${actualWinnerText(closest)}
          </strong>

        </div>

        <div class="notable-summary">

          ${
            closest.margin_error_absolute === 0
              ?
              `
                <span class="exact-margin-badge">
                  EXACT MARGIN
                </span>
              `
              :
              `
                Margin error:
                ${closest.margin_error_absolute.toFixed(1)}
                points
              `
          }

        </div>
      `
    });
  }


  if (bestUnderdogWin) {
    cards.push({
      label:
        "BEST UNDERDOG WIN PREDICTION",

      title:
        matchup(
          bestUnderdogWin
        ),

      html: `
        <div class="notable-line">

          <span>
            Market
          </span>

          <strong>
            ${bestUnderdogWin.benchmark_favorite}
            by
            ${bestUnderdogWin.benchmark_margin_absolute.toFixed(1)}
          </strong>

        </div>

        <div class="notable-line">

          <span>
            Pocket Signal
          </span>

          <strong>
            ${bestUnderdogWin.margin_favorite}
            by
            ${bestUnderdogWin.projected_margin_absolute.toFixed(1)}
          </strong>

        </div>

        <div class="notable-line">

          <span>
            Actual
          </span>

          <strong>
            ${actualWinnerText(bestUnderdogWin)}
          </strong>

        </div>

        <div class="notable-summary notable-success">

          Pocket Signal picked the team
          the market had as the underdog
          to win and was correct.

        </div>
      `
    });
  }


  if (biggestMiss) {
    cards.push({
      label:
        "LARGEST MISS",

      title:
        matchup(
          biggestMiss
        ),

      html: `
        <div class="notable-line">

          <span>
            Pocket Signal
          </span>

          <strong>
            ${biggestMiss.model_winner}
            ${biggestMiss.favorite_win_probability.toFixed(1)}%
          </strong>

        </div>

        <div class="notable-line">

          <span>
            Actual
          </span>

          <strong>
            ${actualWinnerText(biggestMiss)}
          </strong>

        </div>

        <div class="notable-summary notable-miss">

          Margin error:
          ${biggestMiss.margin_error_absolute.toFixed(1)}
          points

          <br><br>

          This was Pocket Signal's
          largest margin miss of the week.

        </div>
      `
    });
  }


  notableCalls.innerHTML =
    cards
      .map(
        card => `
          <article class="notable-card">

            <div class="notable-label">
              ${card.label}
            </div>

            <div class="notable-matchup">
              ${card.title}
            </div>

            <div class="notable-detail">
              ${card.html}
            </div>

          </article>
        `
      )
      .join("");
}


/* ============================================================
   PERFORMANCE BY SIGNAL STRENGTH
============================================================ */

function renderSignalPerformance(games) {
  const levels = [
    "Strong",
    "Medium",
    "Weak"
  ];

  signalPerformance.innerHTML =
    levels
      .map(
        level => {

          const subset =
            games.filter(
              game =>
                game.signal_strength ===
                level
            );

          const pct =
            accuracy(
              subset
            );

          const decided =
            decidedGames(
              subset
            ).length;

          return `
            <article
              class="
                signal-performance-card
                signal-performance-${level.toLowerCase()}
              "
            >

              <div class="signal-top">

                <div>

                  <div class="signal-name">
                    ${level}
                  </div>

                  <div class="signal-sample">

                    ${subset.length}
                    game${subset.length === 1 ? "" : "s"}

                    •

                    ${decided}
                    decided

                  </div>

                </div>

                <div class="signal-record">

                  ${
                    subset.length
                      ?
                      formatRecord(
                        subset
                      )
                      :
                      "No games"
                  }

                </div>

              </div>

              <div class="signal-accuracy">

                ${
                  pct === null
                    ?
                    "—"
                    :
                    `${pct.toFixed(1)}%`
                }

              </div>

              <div class="signal-bar">

                <div
                  class="signal-bar-fill"
                  style="
                    width:
                    ${pct ?? 0}%
                  "
                ></div>

              </div>

            </article>
          `;
        }
      )
      .join("");
}


/* ============================================================
   WEEKLY PERFORMANCE
============================================================ */

function renderWeeklyPerformance() {
  const season =
    Number(
      seasonFilter.value
    );

  const seasonGames =
    allGames.filter(
      game =>
        game.season ===
        season
    );

  const weeks = [
    ...new Set(
      seasonGames.map(
        game =>
          game.week
      )
    )
  ].sort(
    (a, b) =>
      a - b
  );


  weeklyPerformance.innerHTML =
    weeks
      .map(
        week => {

          const subset =
            seasonGames.filter(
              game =>
                game.week ===
                week
            );

          const pct =
            accuracy(
              subset
            );

          const rec =
            formatRecord(
              subset
            );

          return `
            <div class="weekly-row">

              <div class="weekly-week">
                Week ${week}
              </div>

              <div class="weekly-bar">

                <div
                  style="
                    width:
                    ${pct ?? 0}%
                  "
                ></div>

              </div>

              <div class="weekly-value">

                ${
                  pct === null
                    ?
                    "—"
                    :
                    `${pct.toFixed(1)}%`
                }

                •

                ${rec}

              </div>

            </div>
          `;
        }
      )
      .join("");
}


/* ============================================================
   GAME RESULTS
============================================================ */

function renderGameResults(games) {
  visibleRecord.textContent =
    games.length
      ?
      `${formatRecord(games)} • ${decidedGames(games).length} decided • ${games.length} total`
      :
      "";

  if (!games.length) {
    resultsList.innerHTML = `
      <div class="empty-results">
        No results match these filters.
      </div>
    `;

    return;
  }




  const sortedGames = [...games].sort((a, b) => {
  const rank = game => {
    if (game.result === "TIE") return 1;
    return game.winner_correct ? 0 : 2;
  };

  const rankDiff = rank(a) - rank(b);

  if (rankDiff !== 0) {
    return rankDiff;
  }

  if (a.week !== b.week) {
    return b.week - a.week;
  }

  return String(a.game_id).localeCompare(
    String(b.game_id)
  );
});

       


  resultsList.innerHTML =
    sortedGames
      .map(
        game => {

          let gradeText =
            "TIE";

          let gradeClass =
            "grade-tie";

          let resultClass =
            "result-tie";


          if (
            game.result !==
            "TIE"
          ) {

            gradeText =
              game.winner_correct
                ?
                "WINNER CORRECT"
                :
                "WINNER MISSED";

            gradeClass =
              game.winner_correct
                ?
                "grade-correct"
                :
                "grade-wrong";

            resultClass =
              game.winner_correct
                ?
                "result-correct"
                :
                "result-wrong";
          }


          const projectedScore =
            `${game.away_team} ` +
            `${game.projected_away_score.toFixed(1)}` +
            ` – ` +
            `${game.home_team} ` +
            `${game.projected_home_score.toFixed(1)}`;


          const actualScore =
            `${game.away_team} ` +
            `${game.away_score}` +
            ` – ` +
            `${game.home_team} ` +
            `${game.home_score}`;


          const projectedMargin =
            `${game.margin_favorite} by ` +
            `${game.projected_margin_absolute.toFixed(1)}`;


          let actualMargin;

          if (
            game.home_score ===
            game.away_score
          ) {
            actualMargin =
              "Tie";
          }

          else {
            const actualWinner =
              game.home_score >
              game.away_score
                ?
                game.home_team
                :
                game.away_team;

            const actualMarginValue =
              Math.abs(
                game.home_score -
                game.away_score
              );

            actualMargin =
              `${actualWinner} by ${actualMarginValue}`;
          }


          const exactMargin =
            game.margin_error_absolute === 0;


          return `
            <article
              class="
                result-game-card
                ${resultClass}
              "
              data-game-id="${game.game_id}"
            >

              <div class="result-game-main">

                <div class="result-score-area">

                  <div class="result-meta">

                    WEEK
                    ${game.week}

                    •

                    FINAL

                  </div>

                  <div class="result-scoreline">

                    <span>
                      ${game.away_team}
                      ${game.away_score}
                    </span>

                    <span class="result-final">
                      FINAL
                    </span>

                    <span>
                      ${game.home_team}
                      ${game.home_score}
                    </span>

                  </div>

                </div>


                <div class="result-model-grid">

                  <div class="result-stat">

                    <div class="result-stat-label">
                      MODEL PICK
                    </div>

                    <div class="result-stat-value">

                      ${game.model_winner}

                      ${game.favorite_win_probability.toFixed(1)}%

                    </div>

                  </div>


                  <div
                    class="
                      result-stat
                      result-score-comparison
                    "
                  >

                    <div class="score-comparison-row">

                      <span>
                        PROJECTED
                      </span>

                      <strong>
                        ${projectedScore}
                      </strong>

                    </div>

                    <div class="score-comparison-divider"></div>

                    <div class="score-comparison-row">

                      <span>
                        ACTUAL
                      </span>

                      <strong>
                        ${actualScore}
                      </strong>

                    </div>

                  </div>


                  <div class="result-margin-comparison">

                    <div class="margin-comparison-row">

                      <span>
                        PROJECTED MARGIN
                      </span>

                      <strong>
                        ${projectedMargin}
                      </strong>

                    </div>

                    <div class="margin-comparison-row">

                      <span>
                        ACTUAL MARGIN
                      </span>

                      <strong>
                        ${actualMargin}
                      </strong>

                    </div>

                  </div>

                </div>


                <div class="result-grade">

                  <div
                    class="
                      grade-pill
                      ${gradeClass}
                    "
                  >
                    ${gradeText}
                  </div>

                  <div>

                    <span
                      class="
                        signal-pill
                        signal-pill-${game.signal_strength.toLowerCase()}
                      "
                    >
                      ${game.signal_strength}
                    </span>

                  </div>

                  ${
                    exactMargin
                      ?
                      `
                        <div class="exact-margin-row-badge">
                          EXACT MARGIN
                        </div>
                      `
                      :
                      `
                        <div class="result-error">
                          Margin error:
                          ${game.margin_error_absolute.toFixed(1)}
                        </div>
                      `
                  }

                </div>

              </div>

            </article>
          `;
        }
      )
      .join("");


  document
    .querySelectorAll(
      ".result-game-card"
    )
    .forEach(
      card => {

        card.addEventListener(
          "click",
          () => {

            openSignal(
              card.dataset.gameId
            );

          }
        );

      }
    );
}


/* ============================================================
   ORIGINAL SIGNAL MODAL
============================================================ */

function openSignal(gameId) {
  const game =
    allGames.find(
      item =>
        item.game_id ===
        gameId
    );

  if (!game) {
    return;
  }


  const marketText =
    `${game.benchmark_favorite} by ` +
    `${game.benchmark_margin_absolute.toFixed(1)}`;


  signalModalContent.innerHTML = `
    <div class="modal-kicker">
      ORIGINAL PRE-GAME SIGNAL
    </div>

    <h2
      id="signalModalTitle"
      class="modal-title"
    >
      ${game.away_team}
      @
      ${game.home_team}
    </h2>

    <div class="modal-sub">

      Week
      ${game.week}

      •

      Preserved forecast snapshot

    </div>


    <div class="modal-grid">

      <div class="modal-stat">

        <span>
          MODEL WINNER
        </span>

        <strong>

          ${game.model_winner}

          ${game.favorite_win_probability.toFixed(1)}%

        </strong>

      </div>


      <div class="modal-stat">

        <span>
          SIGNAL STRENGTH
        </span>

        <strong>
          ${game.signal_strength}
        </strong>

      </div>


      <div class="modal-stat">

        <span>
          PROJECTED SCORE
        </span>

        <strong>

          ${game.away_team}

          ${game.projected_away_score.toFixed(1)}

          –

          ${game.home_team}

          ${game.projected_home_score.toFixed(1)}

        </strong>

      </div>


      <div class="modal-stat">

        <span>
          PROJECTED MARGIN
        </span>

        <strong>

          ${game.margin_favorite}

          by

          ${game.projected_margin_absolute.toFixed(1)}

        </strong>

      </div>


      <div class="modal-stat">

        <span>
          PROJECTED TOTAL
        </span>

        <strong>
          ${game.projected_total.toFixed(1)}
        </strong>

      </div>


      <div class="modal-stat">

        <span>
          MARKET SNAPSHOT
        </span>

        <strong>
          ${marketText}
        </strong>

      </div>

    </div>


    <div class="modal-foot">

      Final:

      ${game.away_team}
      ${game.away_score},

      ${game.home_team}
      ${game.home_score}.

      This view shows the forecast
      values stored before the result
      was graded.

    </div>
  `;


  signalModal.classList.remove(
    "hidden"
  );
}


function closeSignal() {
  signalModal.classList.add(
    "hidden"
  );
}


/* ============================================================
   EVENTS
============================================================ */

seasonFilter.addEventListener(
  "change",
  () => {

    updateWeekOptions();

    render();

  }
);


weekFilter.addEventListener(
  "change",
  render
);


signalFilter.addEventListener(
  "change",
  render
);


resultFilter.addEventListener(
  "change",
  render
);


document
  .querySelectorAll(
    "[data-close-modal]"
  )
  .forEach(
    element => {

      element.addEventListener(
        "click",
        closeSignal
      );

    }
  );


document.addEventListener(
  "keydown",
  event => {

    if (
      event.key ===
      "Escape"
    ) {
      closeSignal();
    }

  }
);


/* ============================================================
   START
============================================================ */

loadResults();