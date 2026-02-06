#!/usr/bin/env bash
# ドキュメントサイズチェックスクリプト
# CLAUDE_*.mdファイルの肥大化を防ぐ

set -e

# 色付き出力
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# 上限設定（行数）
declare -A LIMITS
LIMITS["CLAUDE.md"]=80
LIMITS["CLAUDE_COMMANDS.md"]=160
LIMITS["CLAUDE_TASKS.md"]=120
LIMITS["CLAUDE_NAV.md"]=110
LIMITS["CLAUDE_ARCH.md"]=200

TOTAL_LIMIT=670
WARNING_LIMIT=650

# ファイルの存在チェック
check_files_exist() {
    for file in "${!LIMITS[@]}"; do
        if [[ ! -f "$file" ]]; then
            echo -e "${RED}Error: $file not found${NC}"
            exit 1
        fi
    done
}

# 行数をカウント
count_lines() {
    local file=$1
    wc -l < "$file" | tr -d ' '
}

# チェック実行
check_doc_sizes() {
    local total=0
    local has_warning=0
    local has_error=0

    echo "📊 CLAUDE_*.md サイズチェック"
    echo "================================"

    for file in CLAUDE.md CLAUDE_COMMANDS.md CLAUDE_TASKS.md CLAUDE_NAV.md CLAUDE_ARCH.md; do
        local lines=$(count_lines "$file")
        local limit=${LIMITS[$file]}
        total=$((total + lines))

        printf "%-25s %4d / %4d 行 " "$file" "$lines" "$limit"

        if [[ $lines -gt $limit ]]; then
            echo -e "${RED}❌ 超過 (+$((lines - limit))行)${NC}"
            has_error=1
        elif [[ $lines -gt $((limit - 10)) ]]; then
            echo -e "${YELLOW}⚠️  警告 (残り$((limit - lines))行)${NC}"
            has_warning=1
        else
            echo -e "${GREEN}✅ OK${NC}"
        fi
    done

    echo "================================"
    printf "%-25s %4d / %4d 行 " "合計" "$total" "$TOTAL_LIMIT"

    if [[ $total -gt $TOTAL_LIMIT ]]; then
        echo -e "${RED}❌ 超過 (+$((total - TOTAL_LIMIT))行)${NC}"
        has_error=1
    elif [[ $total -gt $WARNING_LIMIT ]]; then
        echo -e "${YELLOW}⚠️  警告 (残り$((TOTAL_LIMIT - total))行)${NC}"
        has_warning=1
    else
        echo -e "${GREEN}✅ OK (残り$((TOTAL_LIMIT - total))行)${NC}"
    fi

    echo ""

    if [[ $has_error -eq 1 ]]; then
        echo -e "${RED}❌ エラー: ドキュメントサイズが上限を超えています${NC}"
        echo ""
        echo "対策:"
        echo "  1. 詳細な情報をdocs/に移動"
        echo "  2. 冗長な説明を削除"
        echo "  3. 箇条書きや表形式で簡潔化"
        echo ""
        echo "詳細: docs/DOC_MAINTENANCE.md"
        return 1
    elif [[ $has_warning -eq 1 ]]; then
        echo -e "${YELLOW}⚠️  警告: ドキュメントサイズが上限に近づいています${NC}"
        echo ""
        echo "次回更新時に見直しを検討してください"
        echo "詳細: docs/DOC_MAINTENANCE.md"
    else
        echo -e "${GREEN}✅ すべてのドキュメントサイズが適切です${NC}"
    fi

    return 0
}

# メイン処理
main() {
    check_files_exist
    check_doc_sizes
}

main "$@"
