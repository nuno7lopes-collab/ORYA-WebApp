# Device Farm / Mobile QA

## Prereqs
- Device Farm or BrowserStack credentials
- Target URL (prod) available

## AWS Device Farm (skeleton)
```bash
export DEVICE_FARM_PROVIDER=aws
scripts/run-devicefarm.sh
```

## BrowserStack (skeleton)
```bash
export DEVICE_FARM_PROVIDER=browserstack
scripts/run-devicefarm.sh
```

## Lighthouse/A11y
```bash
scripts/run-lighthouse.sh
scripts/run-axe.sh
```

## Evidence to capture
- Screenshots
- Lighthouse score JSON
- Axe report JSON
