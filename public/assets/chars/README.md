# Character artwork (sprite overrides)

Drop transparent OR white-background PNGs here and they replace the
code-drawn fighters automatically (white backgrounds are removed at load):

    assets/chars/sheriffen/idle.png
    assets/chars/vilgot/idle.png
    assets/chars/mille/idle.png
    assets/chars/saga/idle.png

`idle.png` alone is enough - it is used for every pose (the game animates
it as a puppet and layers slash/gun effects). Optional extra poses:
punch.png, kick.png, gunidle.png, shoot.png, hit.png, win.png, draw.png,
portrait.png (used in character select; falls back to idle).

Guidelines: full body, facing right (select-screen portraits may face any
way), feet at the bottom edge, roughly 500-1000px tall.
