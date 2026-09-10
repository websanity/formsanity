<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Expression;

/** The values an expression reads. The host supplies them; the engine only reads strings. */
interface Context
{
	/** The current value of the named field. An unknown or unanswered name reads as `''`. */
	public function get(string $name): string;

	/** The type that governs the ordering comparisons: `date`, `datetime-local`, `time`, an fs type name, or `null` for an untyped field. */
	public function typeOf(string $name): ?string;

	/** Whether the answer of the named field passes the field's own validation. */
	public function valid(string $name): bool;
}
