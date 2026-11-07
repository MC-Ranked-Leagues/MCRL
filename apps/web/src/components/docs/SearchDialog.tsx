import { useStaticSearch } from "fumadocs-core/search/client";
import {
  SearchDialog as FumadocsSearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
  type SharedProps,
} from "@fumadocs/base-ui/components/dialog/search";

export default function SearchDialog(props: SharedProps) {
  // Built at build time by `pages/info/search.json.ts`.
  const search = useStaticSearch({ from: "/info/search.json" });

  return (
    <FumadocsSearchDialog {...search} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList />
      </SearchDialogContent>
    </FumadocsSearchDialog>
  );
}
