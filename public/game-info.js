// Facts about a lobby game record: its name, whether seats are chosen before starting, player limits, still open.
export const gameTitle = g =>
  g?.game === 'pong'
    ? 'Pong'
    : g?.game === 'golf'
      ? 'Golf with your gay friends'
      : g?.game === 'labyrinth'
        ? 'Labyrinth'
        : g?.game === 'moto-trial'
          ? 'Moto Trial'
          : g?.game === 'naval'
            ? 'Battaglia navale'
            : g?.game === 'briscola5'
              ? 'Briscola in cinque'
              : g?.game === 'briscola'
                ? 'Briscola'
                : g?.game === 'scarabeo'
                  ? 'Scarabeo'
                  : g?.game === 'scopa'
                    ? 'Scopa'
                    : g?.game === 'uno'
                      ? 'UNO'
                      : g?.game === 'connect4'
                        ? 'Forza 4'
                        : g?.game === 'checkers'
                          ? 'Dama italiana'
                          : 'Checkmate!';
export const staged = g => ['uno', 'scarabeo', 'scopa', 'naval', 'briscola', 'briscola5'].includes(g?.game);
export const gameLimits = g =>
  g?.limits ||
  (g?.game === 'briscola5'
    ? { min: 5, max: 5 }
    : ['briscola', 'scarabeo', 'scopa'].includes(g?.game)
      ? { min: 2, max: 4 }
      : g?.game === 'uno'
        ? { min: 2, max: 10 }
        : { min: 2, max: 2 });
export const ongoing = g => !g.archived && (g.phase !== 'finished' || (g.series && !g.series.done));
