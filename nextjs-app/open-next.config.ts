import type { OpenNextConfig } from "@opennextjs/aws/types/open-next";

const config = {
	default: {
		// Exclure les routes statiques du serveur par défaut
		override: {
			wrapper: "aws-lambda-streaming",
			converter: "aws-apigw-v2",
			incrementalCache: "s3",
		},
	},
	functions: {
		// Serveur dédié aux routes dynamiques
		dynamic: {
			routes: ["app/fetching/page"],
			patterns: ["fetching"],
		},
	},
	// Configuration cruciale pour les pages statiques
	dangerous: {
		// Activer l'interception de cache pour servir les pages SSG directement
		enableCacheInterception: true,
	},
	// Force copying instead of symlinking for better Lambda compatibility
	buildCommand: "npm run build",
	packageJsonPath: "./package.json",
} satisfies OpenNextConfig;

export default config;
