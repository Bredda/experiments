import { CreateRunForm } from "@/components/create-run/form";
import { Page, PageHeader } from "@/components/page";
import { generateRandomTitle, generateSeed } from "@/lib/utils";

export default function CreateRunPage() {
	// Generated on the server and passed down so SSR and hydration agree.
	return (
		<Page>
			<PageHeader
				title="New run"
				description="Configure a scenario and create a new run."
			/>
			<CreateRunForm
				defaultName={generateRandomTitle()}
				defaultSeed={generateSeed()}
			/>
		</Page>
	);
}
