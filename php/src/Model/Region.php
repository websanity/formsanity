<?php

declare(strict_types=1);

namespace WebSanity\FormSanity\Model;

use WebSanity\FormSanity\Expression\Compiled;

/** An element that governs every control inside it with one expression. */
final readonly class Region
{
	public function __construct(public Compiled $expr)
	{
	}
}
