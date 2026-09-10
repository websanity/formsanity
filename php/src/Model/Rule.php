<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Model;

/** One rule read from a field, holding the authored value of its attribute and the prose an author supplied for it. */
final readonly class Rule
{
	public function __construct(public string $kind, public string $param, public ?string $message = null)
	{
	}
}
