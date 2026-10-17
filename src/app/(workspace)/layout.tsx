import { Workbench } from "../../components/shell/Workbench";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <Workbench>{children}</Workbench>;
}
