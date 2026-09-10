<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Model;

use WebSanity\FormSanity\Expression\Compiled;

/** One rule read from a field, holding the authored value of its attribute, the prose an author supplied for it, and the expression a constraint compiles to. */
final readonly class Rule
{
	public function __construct(public string $kind, public string $param, public ?string $message = null, public ?Compiled $compiled = null)
	{
	}
}
