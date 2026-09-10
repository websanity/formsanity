<?php

declare(strict_types=1);

namespace WebSanity\FormSanity;

/** Builds the response envelopes of the submission protocol: accepted, invalid, error, and the uniqueness check answer. */
final class Envelope
{
	public static function accepted(?string $message = null, ?string $redirect = null): array
	{
		$envelope = ['formsanity' => 2, 'status' => 'accepted'];

		if ($message !== null) {
			$envelope['message'] = $message;
		}

		if ($redirect !== null) {
			$envelope['redirect'] = $redirect;
		}

		return $envelope;
	}

	/** @param list<array{field: ?string, code: string, message: string}> $errors */
	public static function invalid(array $errors): array
	{
		if ($errors === []) {
			throw new \InvalidArgumentException('An invalid envelope requires at least one error.');
		}

		return ['formsanity' => 2, 'status' => 'invalid', 'errors' => $errors];
	}

	public static function error(?string $message = null): array
	{
		$envelope = ['formsanity' => 2, 'status' => 'error'];

		if ($message !== null) {
			$envelope['message'] = $message;
		}

		return $envelope;
	}

	public static function unique(bool $unique): array
	{
		return ['formsanity' => 2, 'unique' => $unique];
	}
}
