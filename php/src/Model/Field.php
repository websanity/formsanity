<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Model;

use WebSanity\FormSanity\Expression\Compiled;

/** Every control that shares one `name`, with the rules the vocabulary reads from them. */
final readonly class Field
{
	/**
	 * @param list<Control> $controls
	 * @param list<Rule> $rules
	 * @param ?Compiled $required the conditional requiredness expression, null when native `required` decides instead
	 */
	public function __construct(
		public string $name,
		public array $controls,
		public bool $set,
		public ?string $type,
		public ?string $typeParam,
		public array $rules,
		public ?Compiled $required,
		public bool $nativeRequired,
		public ?string $uniqueUrl,
	) {
	}
}
