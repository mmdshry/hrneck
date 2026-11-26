#!/usr/bin/env bash
# Sourced by deploy.sh. Generated tenant report PDFs are being removed from git. `git reset --hard`
# deletes tracked files that disappear from the new commit, so copy them out first and put back
# anything that is missing afterwards. Existing files are never overwritten.

PRESERVED_REPORTS_ARCHIVE=""

# preserve_tracked_reports <repo_root> <backup_dir>
preserve_tracked_reports() {
  local root="$1" backup_dir="$2" path
  local -a files=()

  while IFS= read -r -d '' path; do
    if [[ -f "$root/$path" ]]; then
      files+=("$path")
    fi
  done < <(git -C "$root" ls-files -z -- 'apps/api/storage/tenant*/app/reports/*')

  PRESERVED_REPORTS_ARCHIVE=""
  if (( ${#files[@]} == 0 )); then
    return 0
  fi

  mkdir -p "$backup_dir"
  PRESERVED_REPORTS_ARCHIVE="$backup_dir/reports-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
  printf '%s\0' "${files[@]}" | tar -C "$root" --null -T - -czf "$PRESERVED_REPORTS_ARCHIVE"
  echo "Saved ${#files[@]} generated report(s) to $PRESERVED_REPORTS_ARCHIVE"
}

# restore_preserved_reports <repo_root>
restore_preserved_reports() {
  local root="$1" staging

  if [[ -z "$PRESERVED_REPORTS_ARCHIVE" || ! -f "$PRESERVED_REPORTS_ARCHIVE" ]]; then
    return 0
  fi

  staging="$(mktemp -d)"
  tar -C "$staging" -xzf "$PRESERVED_REPORTS_ARCHIVE"
  cp -rn "$staging/." "$root/"
  rm -rf "$staging"
  echo "Restored generated reports from $PRESERVED_REPORTS_ARCHIVE (existing files left untouched)"
}
