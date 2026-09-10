<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Model;

use WebSanity\FormSanity\Expression\Compiled;

/** One `input`, `select`, or `textarea`, with the attributes that decide whether it takes part and what it accepts. */
final readonly class Control
{
	/**
	 * @param list<int> $regionIndexes the regions that contain this control, outermost first
	 * @param array<string, ?Compiled> $options every option value of a select, mapped to its relevance expression
	 * @param array<string, string> $native the native constraint attributes the control carries
	 */
	public function __construct(
		public string $tag,
		public string $type,
		public bool $multiple,
		public string $value,
		public ?Compiled $relevant,
		public array $regionIndexes,
		public array $options,
		public array $native,
	) {
	}
}
