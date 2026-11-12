# Migrations

- Never delete or rename an applied migration file; the deploy marks remote-only versions reverted only as a fallback. Why: the CLI refuses every push while remote history lists missing files.
