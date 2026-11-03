import Activity from "lucide-react/icons/activity";
import Boxes from "lucide-react/icons/boxes";
import Database from "lucide-react/icons/database";
import FileCode2 from "lucide-react/icons/file-code-2";
import FileImage from "lucide-react/icons/file-image";
import FileJson from "lucide-react/icons/file-json";
import FolderOpen from "lucide-react/icons/folder-open";
import Palette from "lucide-react/icons/palette";
import Route from "lucide-react/icons/route";
import type { FileTab } from "../stores/ui-store";

export const SOURCE_FILE_PATTERN = /\.(tsx?|jsx?|vue|astro)$/i;
export const STYLE_FILE_PATTERN = /\.(css|scss|sass|less|styl|stylus)$/i;
export const IMAGE_FILE_PATTERN = /\.(png|jpe?g|gif|webp|avif|ico|bmp)$/i;
export const VECTOR_FILE_PATTERN = /\.svg$/i;
export const FONT_FILE_PATTERN = /\.(woff2?|ttf|otf|eot)$/i;
export const DATA_FILE_PATTERN = /\.(json|graphql|gql|mdx)$/i;
export const BINARY_ASSET_PATTERN =
  /\.(png|jpe?g|gif|webp|avif|ico|bmp|woff2?|ttf|otf|eot)$/i;
export const KEPT_FILE_PATTERN =
  /\.(tsx?|jsx?|vue|astro|css|scss|sass|less|styl|stylus|svg|png|jpe?g|gif|webp|avif|ico|bmp|woff2?|ttf|otf|eot|json|graphql|gql|mdx)$/i;

export const fileCategory = (file: string) =>
  STYLE_FILE_PATTERN.test(file)
    ? "style"
    : IMAGE_FILE_PATTERN.test(file) ||
        VECTOR_FILE_PATTERN.test(file) ||
        FONT_FILE_PATTERN.test(file)
      ? "asset"
      : DATA_FILE_PATTERN.test(file)
        ? "data"
        : "source";

export const sourceExtension = (file: string) =>
  file.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "file";

export const fileIcon = (file: string) =>
  fileCategory(file) === "style" ? (
    <Palette aria-hidden='true' />
  ) : fileCategory(file) === "asset" ? (
    <FileImage aria-hidden='true' />
  ) : fileCategory(file) === "data" ? (
    <FileJson aria-hidden='true' />
  ) : file.includes("hooks/") ? (
    <Activity aria-hidden='true' />
  ) : file.includes("services/") ? (
    <Database aria-hidden='true' />
  ) : file.includes("pages/") ? (
    <Route aria-hidden='true' />
  ) : (
    <FileCode2 aria-hidden='true' />
  );

export const fileTabIcon = (tab: FileTab) =>
  tab === "Components" ? (
    <Boxes aria-hidden='true' />
  ) : tab === "Routes" ? (
    <Route aria-hidden='true' />
  ) : tab === "Hooks" ? (
    <Activity aria-hidden='true' />
  ) : tab === "Styles" ? (
    <Palette aria-hidden='true' />
  ) : tab === "Assets" ? (
    <FileImage aria-hidden='true' />
  ) : (
    <FolderOpen aria-hidden='true' />
  );
