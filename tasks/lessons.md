# Lessons Learned

Ce fichier est lu au debut de chaque session. Chaque lecon est une regle a appliquer.

---

## L1: Base UI (base-nova) API differences from Radix
- `Select.onValueChange` passes `string | null`, not `string`. Wrap with null guard: `(v) => v && setValue(v)`
- `DropdownMenuTrigger` uses `render={<Button />}` pattern instead of `asChild`
- `PopoverTrigger` uses `render={<Button />}` pattern instead of `asChild`
- `DialogTrigger` uses `render={<Button />}` pattern instead of `asChild`
- `AlertDialogCancel` uses `render={<Button variant="outline" />}` internally
- `BreadcrumbLink` uses `render={<Link href="..." />}` for Next.js routing
- Always read the generated component source in `src/components/ui/` before using — base-nova APIs differ from Radix-based shadcn docs

## L2: Always build-verify after each batch
- Run `pnpm build` after each group of changes to catch type errors early
- Base UI type mismatches surface only at build time (not in IDE), especially for callback signatures
