# [Claude Roulette](https://youtu.be/Y0dibfhsyHE)

A physics-based roulette wheel for raffles of up to 37 people. Enter names, spin, and let real physics decide the winner.

## How It Works

The wheel mirrors a European roulette layout with 37 numbered pockets (0-36). Each name you enter is randomly assigned to one pocket, leaving the rest empty. When you spin:

1. The wheel starts rotating clockwise while the ball launches counter-clockwise at a random speed
2. Friction decelerates the ball on the outer track until it loses enough speed to drop inward
3. The ball spirals toward the pockets, potentially bouncing off diamond deflectors along the way
4. Once in the pocket zone, the ball bounces off fret dividers with energy loss until it settles
5. The pocket it lands in determines the outcome — if it has a name, that person wins; if empty, no winner

Nothing is predetermined. The ball gets a random initial velocity and physics runs in real time, so every spin has a genuinely different trajectory and duration (~3-7 seconds).

## Using It for a Raffle

- Enter up to 37 names (comma or newline separated)
- With fewer names, most pockets are empty, so "No Winner" results are common — just spin again
- Winner history is tracked so you can see all past results
- To pick multiple winners, spin repeatedly and check the history log

## Running Locally

```
npm install
npm run dev       # Dev server at localhost:5173
npm run build     # Production build to dist/
```

## Features

- Dark/light theme (persisted to localStorage)
- Confetti celebration on winner
- Click the center hub or the Spin button to spin
- Responsive canvas that scales to fit the container
