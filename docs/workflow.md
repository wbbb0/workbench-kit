# Workflow

The recommended workflow keeps `workbench-kit` as an independent git project and lets each application lock a specific commit through a submodule pointer.

## Mental Model

- `workbench-kit` owns the shared Vue source packages.
- Each application owns its product-specific views, API adapters, route registry, stores, and theme values.
- The application repository records exactly which `workbench-kit` commit it uses.

## Working On An App

Edit the application normally and commit changes in the application repository.

## Working On workbench-kit From An App

It is fine to edit the submodule while working inside an application checkout:

```bash
cd vendor/workbench-kit
git checkout -b feature/layout-fix
git add .
git commit -m "Improve disclosure stack layout"
git push origin feature/layout-fix
```

After the change is merged or otherwise ready to consume, update the application submodule pointer:

```bash
cd vendor/workbench-kit
git checkout main
git pull --ff-only

cd ../..
git add vendor/workbench-kit
git commit -m "Update workbench kit"
```

## Updating Another App

When another application pulls a commit that changes the submodule pointer:

```bash
git pull
git submodule update --init --recursive
npm --prefix webui install
```

To deliberately move an app to the latest `workbench-kit` commit:

```bash
cd vendor/workbench-kit
git checkout main
git pull --ff-only

cd ../..
git add vendor/workbench-kit
git commit -m "Update workbench kit"
```

## Versioning

Use tags for stable checkpoints:

```bash
cd vendor/workbench-kit
git tag v0.1.0
git push origin v0.1.0
```

Applications should lock a concrete commit or tag through the submodule pointer rather than floating automatically with `main`.

## Why Not npm Registry

This setup avoids publishing to the npm registry while still giving every application a reproducible dependency version. It also keeps source-level debugging simple because the shared package code lives inside each app checkout.

