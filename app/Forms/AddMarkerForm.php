<?php
namespace App\Forms;

use Kris\LaravelFormBuilder\Form;

class AddMarkerForm extends Form
{
    public function buildForm()
    {
        $this
            ->add('name', 'text', ['label' => 'Title:', 'wrapper' => ['class' => 'form-group input-group-sm']])
            ->add('description', 'textarea', ['label' => 'Description:', 'wrapper' => ['class' => 'form-group input-group-sm'], 'help_block' => [
                'text' => 'Description or URL',
                'tag'  => 'small',
                'attr' => ['class' => 'form-text text-muted'],
            ]])
            ->add('file', 'file', ['label' => 'Photo:', 'wrapper' => ['class' => 'form-group input-group-sm'], 'help_block' => [
                'text' => 'Photo or image - JPG or PNG allowed.',
                'tag'  => 'small',
                'attr' => ['class' => 'form-text text-muted'],
            ]])
            ->add('lat', 'hidden')
            ->add('lon', 'hidden')
            ->add('submit', 'submit', ['label' => 'Create marker', 'attr' => ['class' => 'btn btn-primary btn-block']]);
    }
}
