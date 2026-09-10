<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Types;

/** An authored `pattern` attribute as the regular expression that matches it, built in the one place both the markup parser and the native register read it from. */
final class Pattern
{
	/** A delimiter no author writes inside a `pattern`, so the authored expression needs no escaping. */
	private const string DELIMITER = "\x01";

	/** The expression is anchored at both ends, runs in Unicode mode, and carries `D` so the end anchor means the end of the string and not the line before a trailing newline. */
	public static function expression(string $pattern): string
	{
		return self::DELIMITER . '^(?:' . $pattern . ')$' . self::DELIMITER . 'uD';
	}
}
