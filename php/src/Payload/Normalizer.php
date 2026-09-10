<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Payload;

use WebSanity\FormSanity\Model\Field;
use WebSanity\FormSanity\Model\Form;

/** Reads a request body into the one value shape each field of the form owns, so the two encodings of the submission protocol reach the validator alike. */
final class Normalizer
{
	/** The control types whose field carries a list of values: a choice set of any member count, and a multiple select. */
	private const array LIST_TYPES = ['checkbox', 'radio', 'select-multiple'];

	/**
	 * @param array<array-key, mixed> $payload the decoded JSON body, or the form parts of a multipart body
	 * @param array<array-key, mixed> $files the upload entries, in the shape of `$_FILES`
	 * @return array<string, string|list<string>|list<Upload>>
	 */
	public static function normalize(array $payload, array $files, Form $form): array
	{
		$payload = self::authoredNames($payload);
		$files = self::authoredNames($files);
		$normalized = [];

		foreach ($form->fields as $name => $field) {
			$name = (string) $name;

			if (self::isFileField($field)) {
				// A file field has no JSON form, so a body that carries a key for one is not a submission this protocol describes.
				if (array_key_exists($name, $payload)) {
					throw new \InvalidArgumentException(sprintf('The payload carries a value for the file field "%s", which only travels as multipart parts.', $name));
				}

				$normalized[$name] = self::uploads($files[$name] ?? null);
				continue;
			}

			$value = $payload[$name] ?? null;
			$normalized[$name] = self::isListField($field) ? self::toList($value) : self::toText($value);
		}

		// An upload under a name the markup does not define is read as a file field would be, so the validator sees an unknown key of the shape it expects.
		foreach ($files as $key => $entry) {
			if (!array_key_exists($key, $normalized)) {
				$normalized[(string) $key] = self::uploads($entry);
			}
		}

		// Keys the markup does not define are kept as they arrive, so the validator can apply the position it takes on unknown fields.
		foreach ($payload as $key => $value) {
			if (!array_key_exists($key, $normalized)) {
				$normalized[(string) $key] = $value;
			}
		}

		return $normalized;
	}

	/**
	 * A multipart body suffixes every part of an array-valued field with `[]`. Exactly one such suffix is stripped, before anything decides what a key names.
	 *
	 * @param array<array-key, mixed> $entries
	 * @return array<string, mixed>
	 */
	private static function authoredNames(array $entries): array
	{
		$named = [];

		foreach ($entries as $key => $value) {
			$key = (string) $key;
			$named[str_ends_with($key, '[]') ? substr($key, 0, -2) : $key] = $value;
		}

		return $named;
	}

	private static function isFileField(Field $field): bool
	{
		return $field->controls[0]->type === 'file';
	}

	private static function isListField(Field $field): bool
	{
		return in_array($field->controls[0]->type, self::LIST_TYPES, true);
	}

	/** An absent key, an empty string, and an empty array are the same answer, so a single-valued field reads them all as the empty string. */
	private static function toText(mixed $value): string
	{
		if (is_array($value)) {
			$value = $value === [] ? '' : reset($value);
		}

		return self::scalar($value);
	}

	/** @return list<string> */
	private static function toList(mixed $value): array
	{
		if ($value === null || $value === '' || $value === []) {
			return [];
		}

		return array_values(array_map(self::scalar(...), is_array($value) ? $value : [$value]));
	}

	/** Every field value of the protocol travels as a string. A body that sends a JSON number or boolean is read as the text of it. */
	private static function scalar(mixed $value): string
	{
		return match (true) {
			is_string($value) => $value,
			is_bool($value) => $value ? '1' : '',
			is_int($value), is_float($value) => (string) $value,
			default => '',
		};
	}

	/**
	 * PHP presents one upload as a flat entry and a `multiple` input as parallel arrays. Both become a list, because a file field always holds one.
	 *
	 * @return list<Upload>
	 */
	private static function uploads(mixed $entry): array
	{
		if (!is_array($entry) || !isset($entry['name'])) {
			return [];
		}

		if (!is_array($entry['name'])) {
			$entry = array_map(static fn (mixed $value): array => [$value], $entry);
		}

		$uploads = [];

		foreach (array_keys($entry['name']) as $index) {
			// An entry that reports no file is no answer, exactly as an absent key is.
			if ((int) ($entry['error'][$index] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
				continue;
			}

			$uploads[] = new Upload(
				self::scalar($entry['name'][$index]),
				self::scalar($entry['type'][$index] ?? ''),
				(int) ($entry['size'][$index] ?? 0),
			);
		}

		return $uploads;
	}
}
