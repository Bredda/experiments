export { cn } from "cn";

import { faker } from "@faker-js/faker";

const SEED_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function generateSeed(length = 8): string {
	if (!Number.isInteger(length) || length < 1) {
		throw new Error("Seed length must be a positive integer");
	}

	// 256 % 36 = 4 : on rejette les 4 derniers octets pour éviter le biais du modulo
	const limit = 256 - (256 % SEED_ALPHABET.length);
	let seed = "";

	while (seed.length < length) {
		for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
			if (byte < limit && seed.length < length) {
				seed += SEED_ALPHABET[byte % SEED_ALPHABET.length];
			}
		}
	}

	return seed;
}

export function generateRandomName(excludes?: string[]) {
	const excludes_ = excludes ?? [];
	let randomName = "";
	while (excludes_.includes(randomName) || randomName === "") {
		randomName = faker.person.firstName();
	}
	return randomName;
}

export function generateRandomNames(numberOfNames: number) {
	if (numberOfNames <= 0) throw new Error("'numberOfNames' must be positive");
	const names = [] as string[];

	for (let i = 0; i < numberOfNames; i++) {
		names.push(generateRandomName(names));
	}

	return names;
}

/** A fun, human-readable match name proposal, e.g. "Crooked Lighthouse". */
export function generateRandomTitle() {
	const capitalize = (word: string) =>
		word.charAt(0).toUpperCase() + word.slice(1);
	return `${capitalize(faker.word.adjective())} ${capitalize(faker.word.noun())}`;
}
